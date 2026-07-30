import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const roleInclude = {
  permissions: {
    include: {
      permission: true,
    },
    orderBy: {
      permission: {
        code: 'asc',
      },
    },
  },
  _count: {
    select: {
      users: true,
    },
  },
} satisfies Prisma.RoleInclude;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    const name = this.cleanName(dto.name);
    await this.ensureUniqueName(name);
    await this.ensurePermissionsExist(dto.permissionIds ?? []);

    return this.prisma.role.create({
      data: {
        name,
        permissions: {
          create: (dto.permissionIds ?? []).map((permissionId) => ({
            permissionId,
          })),
        },
      },
      include: roleInclude,
    });
  }

  findAll() {
    return this.prisma.role.findMany({
      include: roleInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      include: roleInclude,
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);

    const name = dto.name === undefined ? undefined : this.cleanName(dto.name);

    if (name) {
      await this.ensureUniqueName(name, id);
    }

    if (dto.permissionIds) {
      await this.ensurePermissionsExist(dto.permissionIds);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds) {
        await this.replacePermissions(tx, id, dto.permissionIds);
      }

      return tx.role.update({
        data: { name },
        include: roleInclude,
        where: { id },
      });
    });
  }

  async updatePermissions(id: string, dto: UpdateRolePermissionsDto) {
    await this.findOne(id);
    await this.ensurePermissionsExist(dto.permissionIds);

    return this.prisma.$transaction(async (tx) => {
      await this.replacePermissions(tx, id, dto.permissionIds);

      return tx.role.findUniqueOrThrow({
        include: roleInclude,
        where: { id },
      });
    });
  }

  async remove(id: string) {
    const role = await this.findOne(id);

    if (role.name === 'admin') {
      throw new BadRequestException('No se puede eliminar el rol admin');
    }

    if (role._count.users > 0) {
      throw new BadRequestException(
        'No se puede eliminar un rol asignado a usuarios',
      );
    }

    await this.prisma.role.delete({ where: { id } });

    return { success: true };
  }

  private cleanName(value: string) {
    const name = value.trim().toLowerCase();

    if (!name) {
      throw new BadRequestException('El nombre del rol es obligatorio');
    }

    return name;
  }

  private async ensureUniqueName(name: string, currentRoleId?: string) {
    const existing = await this.prisma.role.findUnique({ where: { name } });

    if (existing && existing.id !== currentRoleId) {
      throw new ConflictException('El rol ya existe');
    }
  }

  private async ensurePermissionsExist(permissionIds: string[]) {
    if (!permissionIds.length) {
      return;
    }

    const count = await this.prisma.permission.count({
      where: { id: { in: permissionIds } },
    });

    if (count !== permissionIds.length) {
      throw new BadRequestException('Uno o mas permisos no existen');
    }
  }

  private async replacePermissions(
    tx: Prisma.TransactionClient,
    roleId: string,
    permissionIds: string[],
  ) {
    await tx.rolePermission.deleteMany({ where: { roleId } });

    if (!permissionIds.length) {
      return;
    }

    await tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  }
}
