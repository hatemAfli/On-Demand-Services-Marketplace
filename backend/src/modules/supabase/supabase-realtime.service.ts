import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BROADCAST_SUBSCRIBE_MS = 8_000;

type SubscribePhase = 'joining' | 'sending' | 'done';

@Injectable()
export class SupabaseRealtimeService {
  private readonly logger = new Logger(SupabaseRealtimeService.name);
  private readonly client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const key = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Broadcast on `conversation:{conversationId}` so clients subscribed to that
   * channel receive `new_message` without polling.
   *
   * Never rejects: failures are logged. Avoids synchronous `removeChannel` inside
   * Realtime subscribe callbacks (re-entrancy caused stack overflow with @supabase/realtime-js).
   */
  async broadcastMessage(
    conversationId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.broadcastConversationEvent(
      conversationId,
      'new_message',
      payload,
    );
  }

  async broadcastConversationEvent(
    conversationId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.broadcast(`conversation:${conversationId}`, event, payload);
  }

  /**
   * Broadcast on `notifications:{userId}` so the recipient's app updates in real time.
   */
  async broadcastNotification(
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.broadcast(`notifications:${userId}`, 'new_notification', payload);
  }

  /**
   * Broadcast on `appointment:{appointmentId}` so client and provider detail screens
   * update status and timer without polling.
   */
  async broadcastAppointmentUpdated(
    appointmentId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.broadcast(
      `appointment:${appointmentId}`,
      'appointment_updated',
      payload,
    );
  }

  private async broadcast(
    channelName: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const channel = this.client.channel(channelName);

    await new Promise<void>((resolve) => {
      let phase: SubscribePhase = 'joining';
      let finished = false;

      const safeFinish = () => {
        if (finished) return;
        finished = true;
        phase = 'done';
        setImmediate(() => {
          try {
            void this.client.removeChannel(channel);
          } catch {
            /* ignore */
          }
          resolve();
        });
      };

      const timeout = setTimeout(() => {
        if (phase !== 'joining') return;
        this.logger.warn(`Realtime subscribe timeout (${channelName})`);
        safeFinish();
      }, BROADCAST_SUBSCRIBE_MS);

      channel.subscribe((status, err) => {
        if (finished) return;

        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          phase = 'sending';
          void channel
            .send({
              type: 'broadcast',
              event,
              payload,
            })
            .then(() => {
              safeFinish();
            })
            .catch((e: unknown) => {
              this.logger.warn(
                `Realtime broadcast send failed (${channelName}): ${e instanceof Error ? e.message : String(e)}`,
              );
              safeFinish();
            });
          return;
        }

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          // During send, CLOSED can fire from teardown; let the send promise finish the flow.
          if (phase === 'sending') return;

          clearTimeout(timeout);
          const msg =
            err instanceof Error ? err.message : err != null ? String(err) : status;
          this.logger.warn(
            `Realtime broadcast skipped (${channelName}): Realtime channel ${status}: ${msg}`,
          );
          safeFinish();
        }
      });
    });
  }
}
