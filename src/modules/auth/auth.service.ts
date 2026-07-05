import { randomBytes, createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { LoginDto } from './dto/login.dto';

const userInclude = {
  role: {
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  },
} as const;

type JwtDuration = `${number}${'s' | 'm' | 'h' | 'd'}`;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      include: userInclude,
      where: { username: dto.username },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    const tokens = await this.issueTokens(
      authenticatedUser.id,
      authenticatedUser.username,
    );

    return {
      ...tokens,
      user: authenticatedUser,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      include: {
        user: {
          include: userInclude,
        },
      },
      where: { tokenHash },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      !storedToken.user.isActive
    ) {
      throw new UnauthorizedException('Token de actualizacion invalido');
    }

    await this.prisma.refreshToken.update({
      data: { revokedAt: new Date() },
      where: { id: storedToken.id },
    });

    const authenticatedUser = this.toAuthenticatedUser(storedToken.user);
    const tokens = await this.issueTokens(
      authenticatedUser.id,
      authenticatedUser.username,
    );

    return {
      ...tokens,
      user: authenticatedUser,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      data: { revokedAt: new Date() },
      where: {
        revokedAt: null,
        tokenHash: this.hashToken(refreshToken),
      },
    });

    return { success: true };
  }

  private async issueTokens(userId: string, username: string) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, username },
      {
        expiresIn: this.getAccessTokenExpiresIn(),
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      },
    );
    const refreshToken = randomBytes(64).toString('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() +
            this.parseDurationToMs(
              this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
            ),
        ),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationToMs(duration: string) {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit as keyof typeof multipliers];
  }

  private getAccessTokenExpiresIn(): JwtDuration {
    const value = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';

    if (!/^\d+[smhd]$/.test(value)) {
      return '15m';
    }

    return value as JwtDuration;
  }

  private toAuthenticatedUser(user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: {
      id: string;
      name: string;
      permissions: { permission: { code: string } }[];
    };
  }): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
      permissions: user.role.permissions.map(
        (rolePermission) => rolePermission.permission.code,
      ),
    };
  }
}
