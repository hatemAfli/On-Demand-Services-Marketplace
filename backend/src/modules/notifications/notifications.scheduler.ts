import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppointmentStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Runs every 15 minutes
  @Cron('0 */15 * * * *')
  async sendAppointmentReminders(): Promise<void> {
    const now = new Date();

    // 24h reminders
    const windowStart24 = new Date(now.getTime() + 23.75 * 60 * 60 * 1000);
    const windowEnd24 = new Date(now.getTime() + 24.25 * 60 * 60 * 1000);

    const upcoming24 = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        scheduledDate: {
          gte: this.startOfDay(windowStart24),
          lte: this.endOfDay(windowEnd24),
        },
      },
      include: {
        client: { include: { user: true } },
        provider: { include: { user: true } },
        givenService: { select: { service: { include: { translations: true } } } },
      },
    });

    for (const appt of upcoming24) {
      const appointmentDateTime = this.toAppointmentDateTime(
        appt.scheduledDate,
        appt.scheduledTime,
      );
      if (!appointmentDateTime) continue;
      if (!this.isWithinWindow(appointmentDateTime, windowStart24, windowEnd24)) continue;

      const formattedDate = this.formatDateForNotification(appt.scheduledDate);
      void this.notificationsService.send({
        userId: appt.clientId,
        type: NotificationType.APPOINTMENT_REMINDER_24H,
        title: '📅 Reminder — tomorrow',
        body: `You have an appointment tomorrow at ${appt.scheduledTime}. Provider: ${appt.provider.user.firstName}`,
        data: { appointmentId: appt.id, screen: 'ClientAppointmentDetail', date: formattedDate },
      });

      void this.notificationsService.send({
        userId: appt.providerId,
        type: NotificationType.APPOINTMENT_REMINDER_24H,
        title: '📅 Reminder — tomorrow',
        body: `Appointment tomorrow at ${appt.scheduledTime} with ${appt.client.user.firstName}`,
        data: { appointmentId: appt.id, screen: 'ProviderAppointmentDetail', date: formattedDate },
      });
    }

    // 1h reminders
    const windowStart1h = new Date(now.getTime() + 45 * 60 * 1000);
    const windowEnd1h = new Date(now.getTime() + 75 * 60 * 1000);

    const upcoming1h = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        scheduledDate: {
          gte: this.startOfDay(windowStart1h),
          lte: this.endOfDay(windowEnd1h),
        },
      },
      include: {
        client: { include: { user: true } },
        provider: { include: { user: true } },
      },
    });

    for (const appt of upcoming1h) {
      const appointmentDateTime = this.toAppointmentDateTime(
        appt.scheduledDate,
        appt.scheduledTime,
      );
      if (!appointmentDateTime) continue;
      if (!this.isWithinWindow(appointmentDateTime, windowStart1h, windowEnd1h)) continue;

      void this.notificationsService.send({
        userId: appt.clientId,
        type: NotificationType.APPOINTMENT_REMINDER_1H,
        title: '⏰ In 1 hour',
        body: `Your appointment with ${appt.provider.user.firstName} starts at ${appt.scheduledTime}`,
        data: { appointmentId: appt.id, screen: 'ClientAppointmentDetail' },
      });

      void this.notificationsService.send({
        userId: appt.providerId,
        type: NotificationType.APPOINTMENT_REMINDER_1H,
        title: '⏰ In 1 hour',
        body: `Appointment with ${appt.client.user.firstName} at ${appt.scheduledTime}`,
        data: { appointmentId: appt.id, screen: 'ProviderAppointmentDetail' },
      });
    }
  }

  private formatDateForNotification(dateValue: Date): string {
    return dateValue.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private toAppointmentDateTime(scheduledDate: Date, scheduledTime: string): Date | null {
    const [hoursRaw, minutesRaw] = scheduledTime.split(':');
    const hours = Number.parseInt(hoursRaw ?? '', 10);
    const minutes = Number.parseInt(minutesRaw ?? '', 10);
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    const result = new Date(scheduledDate);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  private isWithinWindow(target: Date, start: Date, end: Date): boolean {
    const ts = target.getTime();
    return ts >= start.getTime() && ts <= end.getTime();
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }
}
