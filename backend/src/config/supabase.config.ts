import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const supabaseKey = this.configService.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // Authentication helpers
  async verifyToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error) throw error;
    return data.user;
  }

  /**
   * Verifies email + password against Supabase Auth (GoTrue password grant).
   * Uses the anon key; does not persist a session on the server.
   */
  async verifyPasswordForEmail(
    email: string,
    password: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const rawUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const supabaseUrl = rawUrl.replace(/\/$/, '');
    const anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');

    const res = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ email, password }),
      },
    );

    const body = (await res.json().catch(() => ({}))) as {
      msg?: string;
      error_description?: string;
    };

    if (!res.ok) {
      const message =
        typeof body?.msg === 'string'
          ? body.msg
          : typeof body?.error_description === 'string'
            ? body.error_description
            : 'Invalid credentials';
      return { ok: false, message };
    }

    return { ok: true };
  }

  /** Remove all objects under `avatars/{userId}/` in the `avatars` bucket (client profile photos). */
  async removeClientAvatarFolder(userId: string): Promise<void> {
    const bucket = 'avatars';
    const folder = `avatars/${userId}`;
    const { data: items, error: listError } = await this.supabase.storage
      .from(bucket)
      .list(folder, { limit: 100 });

    if (listError) {
      console.warn('[SupabaseService] list avatars folder failed', listError);
      return;
    }

    if (!items?.length) return;

    const paths = items.map((f) => `${folder}/${f.name}`);
    const { error: removeError } = await this.supabase.storage
      .from(bucket)
      .remove(paths);

    if (removeError) {
      console.warn('[SupabaseService] remove avatars failed', removeError);
    }
  }
}
