// src/db/users.ts
// All SQL queries relating to the `users` table.

import type { UserRow } from '../types.ts';

export async function findUserByEmail(
    db: D1Database,
    email: string,
): Promise<UserRow | null> {
    const row = await db
        .prepare('SELECT * FROM users WHERE email = ?1 LIMIT 1')
        .bind(email.toLowerCase().trim())
        .first<UserRow>();
    return row ?? null;
}

export async function findUserByUsername(
    db: D1Database,
    username: string,
): Promise<UserRow | null> {
    const row = await db
        .prepare('SELECT * FROM users WHERE username = ?1 LIMIT 1')
        .bind(username.toLowerCase().trim())
        .first<UserRow>();
    return row ?? null;
}

export async function findUserById(
    db: D1Database,
    id: string,
): Promise<UserRow | null> {
    const row = await db
        .prepare('SELECT * FROM users WHERE id = ?1 LIMIT 1')
        .bind(id)
        .first<UserRow>();
    return row ?? null;
}

export interface CreateUserData {
    id: string;
    email: string;
    username: string;
    display_name: string | null;
    password_hash: string;
    salt: string;
    now: number;
}

export async function createUser(
    db: D1Database,
    data: CreateUserData,
): Promise<void> {
    await db
        .prepare(
            `INSERT INTO users
        (id, email, username, display_name, password_hash, salt, role, is_banned, is_verified, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'user', 0, 0, ?7, ?7)`,
        )
        .bind(
            data.id,
            data.email.toLowerCase().trim(),
            data.username.toLowerCase().trim(),
            data.display_name,
            data.password_hash,
            data.salt,
            data.now,
        )
        .run();
}
