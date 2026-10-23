import { describe, expect, it } from 'vitest';
import { eq, relations } from '~/index';
import { integer, sqliteTable, text } from '~/sqlite-core';
import { drizzle } from '~/sqlite-proxy';

const users = sqliteTable('users', {
	id: integer().primaryKey(),
	name: text().notNull(),
	teamId: integer('team_id'),
});
const teams = sqliteTable('teams', {
	id: integer().primaryKey(),
});
const usersRelations = relations(users, ({ one }) => ({
	team: one(teams, { fields: [users.teamId], references: [teams.id] }),
}));

describe('sqlite-proxy row shape', () => {
	it('maps positional array rows', async () => {
		const db = drizzle(async () => ({ rows: [[1, 'John', 10]] }));

		const result = await db
			.select({ id: users.id, name: users.name, teamId: teams.id })
			.from(users)
			.innerJoin(teams, eq(teams.id, users.teamId));

		expect(result).toEqual([{ id: 1, name: 'John', teamId: 10 }]);
	});

	it('throws on object rows in all()', async () => {
		const db = drizzle(async () => ({ rows: [{ id: 1, name: 'John' }] }));

		await expect(db.select({ id: users.id, name: users.name }).from(users)).rejects.toThrowError(
			/rows as arrays/,
		);
	});

	it('throws on object row in get()', async () => {
		const db = drizzle(async () => ({ rows: { id: 1, name: 'John' } as any }));

		await expect(db.select({ id: users.id, name: users.name }).from(users).get()).rejects.toThrowError(
			/rows as arrays/,
		);
	});

	it('throws on object rows in relational queries', async () => {
		const db = drizzle(async () => ({ rows: [{ id: 1, name: 'John', team_id: null }] }), {
			schema: { users, teams, usersRelations },
		});

		await expect(db.query.users.findMany()).rejects.toThrowError(/rows as arrays/);
	});

	it('keeps returning raw rows when no fields are selected', async () => {
		const rows = [{ id: 1 }];
		const db = drizzle(async () => ({ rows }));

		expect(await db.all('select id from users')).toBe(rows);
	});
});
