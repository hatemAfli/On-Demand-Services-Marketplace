import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  CompanyAuditAction,
  DayOfWeek,
  ProviderType,
} from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';
import { AvailabilityService } from '../../availability/availability.service';
import { CompanyAuditService } from '../audit/company-audit.service';
import { CreateDayOffDto } from '../../availability/dto/day-off.dto';
import { UpsertAvailabilityBulkDto } from '../../availability/dto/upsert-availability.dto';
import { GetCompanyScheduleDto } from './dto/get-company-schedule.dto';

const DEFAULT_START = '08:00';
const DEFAULT_END = '18:00';

const CALENDAR_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.EN_ROUTE,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];

const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.EN_ROUTE,
  AppointmentStatus.IN_PROGRESS,
];

const LOAD_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.EN_ROUTE,
  AppointmentStatus.IN_PROGRESS,
];

type TimeInterval = { start: number; end: number };

@Injectable()
export class CompanyScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly audit: CompanyAuditService,
  ) {}

  private async resolveCompanyId(companyAdminUserId: string): Promise<string> {
    const admin = await this.prisma.companyAdmin.findUnique({
      where: { id: companyAdminUserId },
      select: { companyId: true },
    });
    if (!admin?.companyId) {
      throw new NotFoundException('Company admin account not found.');
    }
    return admin.companyId;
  }

  private async assertCompanyEmployee(
    companyId: string,
    providerId: string,
  ) {
    const provider = await this.prisma.provider.findFirst({
      where: { id: providerId, companyId, type: ProviderType.EMPLOYEE },
      select: { id: true },
    });
    if (!provider) {
      throw new NotFoundException('Employee not found in your company.');
    }
  }

  // ─── Day calendar (Gantt) ─────────────────────────────────────────────────

  async getDaySchedule(
    companyAdminUserId: string,
    dto: GetCompanyScheduleDto,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const date = dto.date;
    const dayOfWeek = this.dayOfWeekFromDate(date);

    const employees = await this.prisma.provider.findMany({
      where: {
        companyId,
        type: ProviderType.EMPLOYEE,
        ...(dto.search
          ? {
              user: {
                OR: [
                  {
                    firstName: {
                      contains: dto.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    lastName: {
                      contains: dto.search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            }
          : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        availability: true,
        daysOff: {
          where: { date: new Date(date) },
          take: 1,
        },
        appointments: {
          where: {
            scheduledDate: new Date(date),
            status: { in: CALENDAR_STATUSES },
          },
          include: {
            client: { include: { user: true } },
            givenService: {
              include: {
                service: { include: { translations: true } },
              },
            },
          },
          orderBy: { scheduledTime: 'asc' },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });

    let gridStart = this.toMinutes(DEFAULT_START);
    let gridEnd = this.toMinutes(DEFAULT_END);

    const employeeRows = employees.map((emp) => {
      const dayRow = emp.availability.find((a) => a.dayOfWeek === dayOfWeek);
      const isWorkingToday = dayRow?.isWorking ?? this.isWeekday(dayOfWeek);
      const startTime = dayRow?.startTime ?? DEFAULT_START;
      const endTime = dayRow?.endTime ?? DEFAULT_END;
      const dayOff = emp.daysOff[0] ?? null;

      if (isWorkingToday && !dayOff) {
        gridStart = Math.min(gridStart, this.toMinutes(startTime));
        gridEnd = Math.max(gridEnd, this.toMinutes(endTime));
      }

      const appointments = emp.appointments.map((appt) => {
        const duration =
          appt.durationMinutes ??
          appt.givenService?.estimatedDurationMinutes ??
          60;
        const serviceName =
          appt.givenService?.service?.translations?.[0]?.name ?? 'Service';
        const clientUser = appt.client?.user;
        const clientName = clientUser
          ? `${clientUser.firstName ?? ''} ${clientUser.lastName ?? ''}`.trim()
          : 'Client';

        return {
          id: appt.id,
          status: appt.status,
          scheduledTime: appt.scheduledTime,
          durationMinutes: duration,
          serviceName,
          clientName,
          startMinutes: this.toMinutes(appt.scheduledTime),
          endMinutes: this.toMinutes(appt.scheduledTime) + duration,
        };
      });

      const blocking = appointments.filter((a) =>
        BLOCKING_STATUSES.includes(a.status as AppointmentStatus),
      );
      const hasConflict = this.hasOverlappingIntervals(
        blocking.map((a) => ({ start: a.startMinutes, end: a.endMinutes })),
      );

      const availableMinutes =
        isWorkingToday && !dayOff
          ? Math.max(0, this.toMinutes(endTime) - this.toMinutes(startTime))
          : 0;
      const bookedMinutes = appointments
        .filter((a) => LOAD_STATUSES.includes(a.status as AppointmentStatus))
        .reduce((sum, a) => sum + a.durationMinutes, 0);
      const loadPct =
        availableMinutes > 0
          ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100))
          : 0;

      return {
        id: emp.id,
        displayName:
          `${emp.user?.firstName ?? ''} ${emp.user?.lastName ?? ''}`.trim() ||
          'Provider',
        photoUrl: emp.photoUrl ?? null,
        city: emp.city ?? '',
        isWorkingToday,
        isDayOff: Boolean(dayOff),
        dayOffReason: dayOff?.reason ?? null,
        workingHours:
          isWorkingToday && !dayOff ? { start: startTime, end: endTime } : null,
        loadPct,
        hasConflict,
        appointments,
      };
    });

    const hours = this.buildHourLabels(gridStart, gridEnd);
    const conflicts = this.collectConflicts(employeeRows, date);

    const workingCount = employeeRows.filter(
      (e) => e.isWorkingToday && !e.isDayOff,
    ).length;

    return {
      date,
      dayOfWeek,
      gridStart: this.toHHmm(gridStart),
      gridEnd: this.toHHmm(gridEnd),
      hours,
      employees: employeeRows,
      stats: {
        totalEmployees: employeeRows.length,
        workingToday: workingCount,
        onDayOff: employeeRows.filter((e) => e.isDayOff).length,
        offSchedule: employeeRows.filter(
          (e) => !e.isWorkingToday && !e.isDayOff,
        ).length,
        conflictCount: conflicts.length,
      },
      conflicts,
    };
  }

  // ─── Employee weekly availability ───────────────────────────────────────────

  async getEmployeeAvailability(
    companyAdminUserId: string,
    providerId: string,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    await this.assertCompanyEmployee(companyId, providerId);
    return this.availabilityService.getMyAvailability(providerId);
  }

  async upsertEmployeeAvailability(
    companyAdminUserId: string,
    providerId: string,
    dto: UpsertAvailabilityBulkDto,
    ipAddress?: string,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    await this.assertCompanyEmployee(companyId, providerId);
    const result = await this.availabilityService.upsertAvailabilityForEmployee(
      providerId,
      dto,
    );

    const employeeName = await this.employeeDisplayName(providerId);
    const actor = await this.audit.actorFirstName(companyAdminUserId);
    await this.audit.log(
      companyId,
      companyAdminUserId,
      CompanyAuditAction.SCHEDULE_AVAILABILITY_UPDATED,
      `${actor} updated weekly availability for ${employeeName}.`,
      { providerId, daysUpdated: dto.days?.length ?? 0 },
      ipAddress,
    );

    return result;
  }

  // ─── Employee days off ──────────────────────────────────────────────────────

  async getEmployeeDaysOff(
    companyAdminUserId: string,
    providerId: string,
    from?: string,
    to?: string,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    await this.assertCompanyEmployee(companyId, providerId);
    return this.availabilityService.getMyDaysOff(providerId, from, to);
  }

  async createEmployeeDayOff(
    companyAdminUserId: string,
    providerId: string,
    dto: CreateDayOffDto,
    ipAddress?: string,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    await this.assertCompanyEmployee(companyId, providerId);
    const created = await this.availabilityService.createDayOffForEmployee(
      providerId,
      dto,
    );

    const employeeName = await this.employeeDisplayName(providerId);
    const actor = await this.audit.actorFirstName(companyAdminUserId);
    await this.audit.log(
      companyId,
      companyAdminUserId,
      CompanyAuditAction.SCHEDULE_DAY_OFF_CREATED,
      `${actor} added a day off for ${employeeName} on ${dto.date}.`,
      { providerId, dayOffId: created.id, date: dto.date, reason: dto.reason ?? null },
      ipAddress,
    );

    return created;
  }

  async deleteEmployeeDayOff(
    companyAdminUserId: string,
    providerId: string,
    dayOffId: string,
    ipAddress?: string,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    await this.assertCompanyEmployee(companyId, providerId);

    const dayOff = await this.prisma.providerDayOff.findUnique({
      where: { id: dayOffId },
      select: { id: true, providerId: true, date: true },
    });
    if (!dayOff || dayOff.providerId !== providerId) {
      throw new NotFoundException('Day off not found');
    }

    const result = await this.availabilityService.deleteDayOffForEmployee(
      providerId,
      dayOffId,
    );

    const employeeName = await this.employeeDisplayName(providerId);
    const dateStr = dayOff.date.toISOString().slice(0, 10);
    const actor = await this.audit.actorFirstName(companyAdminUserId);
    await this.audit.log(
      companyId,
      companyAdminUserId,
      CompanyAuditAction.SCHEDULE_DAY_OFF_DELETED,
      `${actor} removed a day off for ${employeeName} on ${dateStr}.`,
      { providerId, dayOffId, date: dateStr },
      ipAddress,
    );

    return result;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async employeeDisplayName(providerId: string): Promise<string> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { user: { select: { firstName: true, lastName: true } } },
    });
    const name =
      `${provider?.user?.firstName ?? ''} ${provider?.user?.lastName ?? ''}`.trim();
    return name || 'employee';
  }

  private collectConflicts(
    employees: Array<{
      id: string;
      displayName: string;
      appointments: Array<{
        id: string;
        serviceName: string;
        scheduledTime: string;
        durationMinutes: number;
        startMinutes: number;
        endMinutes: number;
        status: string;
      }>;
      hasConflict: boolean;
    }>,
    date: string,
  ) {
    const conflicts: Array<{
      providerId: string;
      providerName: string;
      date: string;
      appointments: Array<{
        id: string;
        serviceName: string;
        scheduledTime: string;
        durationMinutes: number;
      }>;
    }> = [];

    for (const emp of employees) {
      if (!emp.hasConflict) continue;
      const blocking = emp.appointments.filter((a) =>
        BLOCKING_STATUSES.includes(a.status as AppointmentStatus),
      );
      conflicts.push({
        providerId: emp.id,
        providerName: emp.displayName,
        date,
        appointments: blocking.map((a) => ({
          id: a.id,
          serviceName: a.serviceName,
          scheduledTime: a.scheduledTime,
          durationMinutes: a.durationMinutes,
        })),
      });
    }
    return conflicts;
  }

  private hasOverlappingIntervals(intervals: TimeInterval[]): boolean {
    if (intervals.length < 2) return false;
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].start < sorted[i - 1].end) return true;
    }
    return false;
  }

  private buildHourLabels(startMinutes: number, endMinutes: number): string[] {
    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.ceil(endMinutes / 60);
    const hours: string[] = [];
    for (let h = startHour; h <= endHour; h += 1) {
      hours.push(`${String(h).padStart(2, '0')}:00`);
    }
    return hours.length > 0 ? hours : [DEFAULT_START, DEFAULT_END];
  }

  private isWeekday(day: DayOfWeek): boolean {
    return day !== DayOfWeek.SATURDAY && day !== DayOfWeek.SUNDAY;
  }

  private dayOfWeekFromDate(date: string): DayOfWeek {
    const d = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date format, expected YYYY-MM-DD');
    }
    const jsDay = d.getUTCDay();
    switch (jsDay) {
      case 0:
        return DayOfWeek.SUNDAY;
      case 1:
        return DayOfWeek.MONDAY;
      case 2:
        return DayOfWeek.TUESDAY;
      case 3:
        return DayOfWeek.WEDNESDAY;
      case 4:
        return DayOfWeek.THURSDAY;
      case 5:
        return DayOfWeek.FRIDAY;
      default:
        return DayOfWeek.SATURDAY;
    }
  }

  private toMinutes(hhmm: string): number {
    const [hh, mm] = hhmm.split(':').map((x) => Number(x));
    return hh * 60 + mm;
  }

  private toHHmm(totalMinutes: number): string {
    const hh = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0');
    const mm = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }
}
