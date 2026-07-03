import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  role: {
    select: {
      id: true,
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    await this.ensureRoleExists(dto.roleId);
    await this.ensureUniqueIdentity(dto.username, dto.email);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: dto.roleId,
      },
      select: userSelect,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      select: userSelect,
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.roleId) {
      await this.ensureRoleExists(dto.roleId);
    }

    if (dto.username || dto.email) {
      await this.ensureUniqueIdentity(dto.username, dto.email, id);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    return this.prisma.user.update({
      data: {
        username: dto.username,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: dto.roleId,
        isActive: dto.isActive,
        passwordHash,
      },
      select: userSelect,
      where: { id },
    });
  }

  async disable(id: string) {
    await this.findOne(id);

    await this.prisma.refreshToken.updateMany({
      data: { revokedAt: new Date() },
      where: {
        userId: id,
        revokedAt: null,
      },
    });

    return this.prisma.user.update({
      data: { isActive: false },
      select: userSelect,
      where: { id },
    });
  }

  private async ensureRoleExists(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }
  }

  private async ensureUniqueIdentity(
    username?: string,
    email?: string,
    currentUserId?: string,
  ) {
    if (!username && !email) {
      return;
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existing && existing.id !== currentUserId) {
      throw new ConflictException('Username or email already exists');
    }
  }
}
