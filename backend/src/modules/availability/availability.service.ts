import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, DayOfWeek } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { CreateDayOffDto } from './dto/day-off.dto';
import { UpsertAvailabilityBulkDto } from './dto/upsert-availability.dto';

const DEFAULT_START = '08:00';
const DEFAULT_END = '18:00';
const SLOT_STEP_MINUTES = 30;

const DAYS_ORDER: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertAvailability(providerId: string, dto: UpsertAvailabilityBulkDto) {
    await this.assertProviderExists(providerId);

    for (const day of dto.days) {
      this.assertValidTimeRange(day.startTime, day.endTime);
      await this.prisma.providerAvailability.upsert({
        where: {
          providerId_dayOfWeek: {
            providerId,
            dayOfWeek: day.dayOfWeek,
          },
        },
        create: {
          providerId,
          dayOfWeek: day.dayOfWeek,
          isWorking: day.isWorking,
          startTime: day.startTime,
          endTime: day.endTime,
        },
        update: {
          isWorking: day.isWorking,
          startTime: day.startTime,
          endTime: day.endTime,
        },
      });
    }

    const allRows = await this.prisma.providerAvailability.findMany({
      where: { providerId },
    });

    return this.withTemplateFallback(allRows, providerId);
  }

  async getMyAvailability(providerId: string) {
    await this.assertProviderExists(providerId);
    const rows = await this.prisma.providerAvailability.findMany({
      where: { providerId },
    });
    return this.withTemplateFallback(rows, providerId);
  }

  /**
   * Persists the default weekly template when the provider has no rows yet
   * (e.g. first-time profile approval). Weekdays 08:00–18:00, weekend off.
   */
  async ensureDefaultWeeklyAvailabilityIfEmpty(providerId: string): Promise<void> {
    await this.assertProviderExists(providerId);
    const existingCount = await this.prisma.providerAvailability.count({
      where: { providerId },
    });
    if (existingCount > 0) return;

    await this.prisma.providerAvailability.createMany({
      data: DAYS_ORDER.map((dayOfWeek) => ({
        providerId,
        dayOfWeek,
        isWorking:
          dayOfWeek !== DayOfWeek.SATURDAY && dayOfWeek !== DayOfWeek.SUNDAY,
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
      })),
    });
  }

  async getProviderAvailability(providerId: string) {
    await this.assertProviderExists(providerId);
    const rows = await this.prisma.providerAvailability.findMany({
      where: { providerId },
    });
    return this.withTemplateFallback(rows, providerId);
  }

  async createDayOff(providerId: string, dto: CreateDayOffDto) {
    await this.assertProviderExists(providerId);

    try {
      return await this.prisma.providerDayOff.create({
        data: {
          providerId,
          date: new Date(dto.date),
          reason: dto.reason?.trim() || null,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('This date is already blocked');
      }
      throw error;
    }
  }

  async deleteDayOff(providerId: string, dayOffId: string) {
    await this.assertProviderExists(providerId);
    const existing = await this.prisma.providerDayOff.findUnique({
      where: { id: dayOffId },
      select: { id: true, providerId: true },
    });

    if (!existing) {
      throw new NotFoundException('Day off not found');
    }
    if (existing.providerId !== providerId) {
      throw new NotFoundException('Day off not found');
    }

    await this.prisma.providerDayOff.delete({ where: { id: dayOffId } });
    return { deleted: true };
  }

  async getMyDaysOff(providerId: string, from?: string, to?: string) {
    await this.assertProviderExists(providerId);
    return this.prisma.providerDayOff.findMany({
      where: {
        providerId,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  async getAvailableSlots(
    providerId: string,
    date: string,
    durationMinutes: number,
  ): Promise<string[]> {
    await this.assertProviderExists(providerId);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      throw new BadRequestException('duration must be a positive number');
    }

    const dayOfWeek = this.dayOfWeekFromDate(date);
    const availability = await this.prisma.providerAvailability.findUnique({
      where: { providerId_dayOfWeek: { providerId, dayOfWeek } },
    });

    const template = this.defaultRow(providerId, dayOfWeek);
    const effective = availability ?? template;

    if (!effective.isWorking) return [];

    const isBlocked = await this.prisma.providerDayOff.findUnique({
      where: {
        providerId_date: {
          providerId,
          date: new Date(date),
        },
      },
      select: { id: true },
    });
    if (isBlocked) return [];

    const appointments = await this.prisma.appointment.findMany({
      where: {
        providerId,
        scheduledDate: new Date(date),
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
      },
      select: {
        scheduledTime: true,
        durationMinutes: true,
      },
    });

    const dayStart = this.toMinutes(effective.startTime);
    const dayEnd = this.toMinutes(effective.endTime);
    if (dayEnd <= dayStart) return [];

    const busyIntervals = appointments
      .map((a) => {
        const start = this.toMinutes(a.scheduledTime);
        const dur = a.durationMinutes ?? durationMinutes;
        return { start, end: start + dur };
      })
      .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end));

    const slots: string[] = [];
    for (
      let slotStart = dayStart;
      slotStart + durationMinutes <= dayEnd;
      slotStart += SLOT_STEP_MINUTES
    ) {
      const slotEnd = slotStart + durationMinutes;
      const overlaps = busyIntervals.some(
        (busy) => slotStart < busy.end && slotEnd > busy.start,
      );
      if (!overlaps) {
        slots.push(this.toHHmm(slotStart));
      }
    }
    return slots;
  }

  private withTemplateFallback(
    rows: Array<{
      providerId: string;
      dayOfWeek: DayOfWeek;
      isWorking: boolean;
      startTime: string;
      endTime: string;
      id: string;
      createdAt: Date;
      updatedAt: Date;
    }>,
    providerId: string,
  ) {
    const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
    return DAYS_ORDER.map((day) => byDay.get(day) ?? this.defaultRow(providerId, day));
  }

  private defaultRow(providerId: string, dayOfWeek: DayOfWeek) {
    const isWeekday =
      dayOfWeek !== DayOfWeek.SATURDAY && dayOfWeek !== DayOfWeek.SUNDAY;
    return {
      id: `default-${providerId}-${dayOfWeek}`,
      providerId,
      dayOfWeek,
      isWorking: isWeekday,
      startTime: DEFAULT_START,
      endTime: DEFAULT_END,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
  }

  private dayOfWeekFromDate(date: string): DayOfWeek {
    const d = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date format, expected YYYY-MM-DD');
    }
    const jsDay = d.getUTCDay(); // 0 Sunday ... 6 Saturday
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
    if (
      !Number.isInteger(hh) ||
      !Number.isInteger(mm) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59
    ) {
      throw new BadRequestException('Invalid time format, expected HH:MM');
    }
    return hh * 60 + mm;
  }

  private toHHmm(totalMinutes: number): string {
    const hh = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0');
    const mm = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private assertValidTimeRange(startTime: string, endTime: string) {
    const start = this.toMinutes(startTime);
    const end = this.toMinutes(endTime);
    if (end <= start) {
      throw new BadRequestException('endTime must be greater than startTime');
    }
  }

  private async assertProviderExists(providerId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
  }
}
