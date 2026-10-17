import { beforeAll, beforeEach, afterAll, describe, test, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { parseBackup } from "../src/features/backup/format";
import { TABLES } from "../src/features/backup/rows";
import { ACCOUNT, OTHER, NOTE } from "./backup-fixture";
let db: PGlite;
const TASK = "55555555-5555-4555-8555-555555555555";
const WORKSPACE = "66666666-6666-4666-8666-666666666666";
const PLAN = "77777777-7777-4777-8777-777777777777";
const CHILD = "88888888-8888-4888-8888-888888888888";
async function asUser(id = ACCOUNT) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("SET ROLE authenticated");
}
async function snapshot() {
  return (
    await db.query<{
      data: {
        version: number;
        accountId: string;
        tables: Record<string, Record<string, unknown>[]>;
      };
    }>("SELECT public.memoflow_export_v1() AS data")
  ).rows[0].data;
}
async function restore(data: unknown, id = ACCOUNT) {
  return (
    await db.query<{ data: { inserted: number; skipped: number } }>(
      "SELECT public.memoflow_restore_v1($1::jsonb, $2::uuid) AS data",
      [JSON.stringify(data), id],
    )
  ).rows[0].data;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public, storage TO authenticated, anon, service_role;
    CREATE TABLE storage.objects (id uuid, name text, bucket_id text);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1, '/') $$;`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
}, 60_000);
beforeEach(async () => {
  await db.exec("RESET ROLE");
  await db.exec(`TRUNCATE ${TABLES.map((t) => `public.${t}`).join(", ")}, auth.users CASCADE`);
  await db.query(
    "INSERT INTO auth.users(id,email) VALUES ($1,'one@example.test'),($2,'two@example.test')",
    [ACCOUNT, OTHER],
  );
  await asUser();
  await db.query(
    "INSERT INTO public.notes(id,user_id,title,content) VALUES ($1,$2,'مذكرة','<p>محفوظ</p>')",
    [NOTE, ACCOUNT],
  );
  await db.query("INSERT INTO public.tasks(id,user_id,title) VALUES ($1,$2,'مهمة')", [
    TASK,
    ACCOUNT,
  ]);
  await db.query("INSERT INTO public.workspaces(id,user_id,name) VALUES ($1,$2,'مشروع')", [
    WORKSPACE,
    ACCOUNT,
  ]);
  await db.query(
    "INSERT INTO public.plans(id,user_id,title,workspace_id) VALUES ($1,$2,'خطة',$3)",
    [PLAN, ACCOUNT, WORKSPACE],
  );
  await db.query(
    "INSERT INTO public.sub_items(id,user_id,parent_type,parent_id,title) VALUES ($1,$2,'task',$3,'بند')",
    [CHILD, ACCOUNT, TASK],
  );
  await db.query(
    "INSERT INTO public.sub_items(user_id,parent_type,parent_id,parent_item_id,title,depth) VALUES ($1,'task',$2,$3,'بند داخلي',1)",
    [ACCOUNT, TASK, CHILD],
  );
  await db.query(
    "INSERT INTO public.vault_settings(user_id,kdf_salt,verifier_iv,verifier_ct) VALUES ($1,'salt','iv','ct')",
    [ACCOUNT],
  );
  await db.query("INSERT INTO public.vault_categories(user_id,name) VALUES ($1,'حسابات')", [
    ACCOUNT,
  ]);
  await db.query(
    "INSERT INTO public.vault_entries(user_id,category_id,label,password_iv,password_ct) SELECT $1,id,'حساب','iv','ct' FROM public.vault_categories WHERE user_id=$1",
    [ACCOUNT],
  );
});
afterAll(async () => {
  await db?.close();
});
describe("backup PostgreSQL transactions and RLS", () => {
  test("all 25 tables match the file schema and restore without losing rows or relationships", async () => {
    await db.query("INSERT INTO public.purchase_lists(user_id,title) VALUES ($1,'قائمة')", [
      ACCOUNT,
    ]);
    await db.query(
      "INSERT INTO public.purchase_items(user_id,purchase_list_id,title,quantity,expected_price) SELECT $1,id,'شراء',1.5,12.25 FROM public.purchase_lists WHERE user_id=$1",
      [ACCOUNT],
    );
    await db.query("INSERT INTO public.plan_stages(user_id,plan_id,name) VALUES ($1,$2,'مرحلة')", [
      ACCOUNT,
      PLAN,
    ]);
    await db.query(
      "INSERT INTO public.plan_steps(user_id,plan_id,stage_id,name) SELECT $1,$2,id,'خطوة' FROM public.plan_stages WHERE plan_id=$2",
      [ACCOUNT, PLAN],
    );
    await db.query(
      "INSERT INTO public.plan_links(user_id,plan_id,item_type,item_id) VALUES ($1,$2,'note',$3)",
      [ACCOUNT, PLAN, NOTE],
    );
    await db.query("INSERT INTO public.subtasks(user_id,task_id,title) VALUES ($1,$2,'تفصيل')", [
      ACCOUNT,
      TASK,
    ]);
    await db.query(
      "INSERT INTO public.task_checklist(user_id,task_id,text) VALUES ($1,$2,'بند قديم')",
      [ACCOUNT, TASK],
    );
    await db.query(
      "INSERT INTO public.attachments(user_id,note_id,name,mime_type,size_bytes,storage_path) VALUES ($1,$2,'ملف','text/plain',1,$3)",
      [ACCOUNT, NOTE, `${ACCOUNT}/file.txt`],
    );
    await db.query(
      "INSERT INTO public.item_attachments(user_id,item_type,item_id,name,mime_type,size_bytes,storage_path) VALUES ($1,'task',$2,'ملف','text/plain',1,$3)",
      [ACCOUNT, TASK, `${ACCOUNT}/task.txt`],
    );
    await db.query(
      "INSERT INTO public.item_comments(user_id,item_type,item_id,body) VALUES ($1,'task',$2,'تعليق')",
      [ACCOUNT, TASK],
    );
    await db.query(
      "INSERT INTO public.item_activity(user_id,item_type,item_id,action) VALUES ($1,'task',$2,'created')",
      [ACCOUNT, TASK],
    );
    await db.query(
      "INSERT INTO public.workspace_links(user_id,workspace_id,title,url) VALUES ($1,$2,'رابط','https://example.test')",
      [ACCOUNT, WORKSPACE],
    );
    await db.query(
      "INSERT INTO public.smart_collections(user_id,workspace_id,name,item_type) VALUES ($1,$2,'مجموعة','task')",
      [ACCOUNT, WORKSPACE],
    );
    await db.query(
      "INSERT INTO public.workspace_activity(user_id,workspace_id,action) VALUES ($1,$2,'created')",
      [ACCOUNT, WORKSPACE],
    );
    const b = await snapshot();
    for (const rows of Object.values(b.tables)) expect(rows.length).toBeGreaterThan(0);
    parseBackup({
      ...b,
      format: "memoflow-backup",
      files: ["file.txt", "task.txt"].map((path) => ({
        path: `${ACCOUNT}/${path}`,
        size: 1,
        mime: "text/plain",
        sha256: "0".repeat(64),
        data: "YQ==",
      })),
    });
    await db.exec("RESET ROLE");
    await db.exec(
      `TRUNCATE ${TABLES.filter((t) => !["profiles", "categories"].includes(t))
        .map((t) => `public.${t}`)
        .join(",")} CASCADE`,
    );
    await asUser();
    await restore(b);
    expect((await snapshot()).tables).toEqual(b.tables);
  });

  test("snapshot includes exactly supported tables and only the current account", async () => {
    const b = await snapshot();
    expect(Object.keys(b.tables).sort()).toEqual([...TABLES].sort());
    for (const [t, rows] of Object.entries(b.tables))
      for (const row of rows) expect(t === "profiles" ? row.id : row.user_id).toBe(ACCOUNT);
    await asUser(OTHER);
    expect((await snapshot()).tables.notes).toHaveLength(0);
  });
  test("deleted records and nested relationships round trip; explicit workspace link IDs survive", async () => {
    const b = await snapshot();
    await db.exec(
      "DELETE FROM public.notes; DELETE FROM public.tasks; DELETE FROM public.sub_items; DELETE FROM public.plans; DELETE FROM public.workspaces; DELETE FROM public.vault_entries; DELETE FROM public.vault_categories; DELETE FROM public.vault_settings;",
    );
    const result = await restore(b);
    expect(result.inserted).toBeGreaterThan(0);
    expect((await snapshot()).tables).toEqual(b.tables);
    const second = await restore(b);
    expect(second.inserted).toBe(0);
  });
  test("existing edits are preserved and a lost-response retry does not duplicate", async () => {
    const b = await snapshot();
    await db.query("UPDATE public.notes SET title='أحدث تعديل' WHERE id=$1", [NOTE]);
    expect((await restore(b)).inserted).toBe(0);
    expect((await snapshot()).tables.notes[0].title).toBe("أحدث تعديل");
  });
  test("invalid late row rolls back earlier inserted rows", async () => {
    const b = await snapshot();
    await db.query("DELETE FROM public.notes WHERE id=$1", [NOTE]);
    b.tables.vault_entries[0].password_ct = null;
    await db.exec("DELETE FROM public.vault_entries");
    await expect(restore(b)).rejects.toThrow();
    expect((await snapshot()).tables.notes).toHaveLength(0);
  });
  test("foreign ownership and expected account mismatch cause no mutation", async () => {
    const b = await snapshot();
    b.tables.notes[0].user_id = OTHER;
    await expect(restore(b)).rejects.toThrow("MF_INVALID_ROW");
    await expect(restore(await snapshot(), OTHER)).rejects.toThrow("MF_ACCOUNT_CHANGED");
  });
  test("foreign FK target is rejected even when PostgreSQL FK itself would permit it", async () => {
    const b = await snapshot();
    await db.exec("RESET ROLE");
    const target = (
      await db.query<{ id: string }>("SELECT id FROM public.categories WHERE user_id=$1 LIMIT 1", [
        OTHER,
      ])
    ).rows[0].id;
    await asUser();
    await db.query("DELETE FROM public.notes WHERE id=$1", [NOTE]);
    b.tables.notes[0].category_id = target;
    await expect(restore(b)).rejects.toThrow("MF_INVALID_RELATION");
    expect((await snapshot()).tables.notes).toHaveLength(0);
  });
  test("vault key conflict aborts missing-note restore", async () => {
    const b = await snapshot();
    await db.query("DELETE FROM public.notes WHERE id=$1", [NOTE]);
    b.tables.vault_settings[0].kdf_salt = "different";
    await expect(restore(b)).rejects.toThrow("MF_VAULT_KEY_CONFLICT");
    expect((await snapshot()).tables.notes).toHaveLength(0);
  });
  test("unknown columns, duplicate IDs and unsupported table names rejected", async () => {
    const b = await snapshot();
    b.tables.notes[0].unexpected = true;
    await expect(restore(b)).rejects.toThrow("MF_INVALID_ROW");
    delete b.tables.notes[0].unexpected;
    b.tables.notes.push(b.tables.notes[0]);
    await expect(restore(b)).rejects.toThrow("MF_DUPLICATE_ID");
    b.tables.secrets = [];
    await expect(restore(b)).rejects.toThrow("MF_INVALID_TABLES");
  });
  test("anonymous role cannot call export or restore", async () => {
    const b = await snapshot();
    await db.exec("RESET ROLE; SET ROLE anon");
    await expect(snapshot()).rejects.toThrow("permission denied");
    await expect(restore(b)).rejects.toThrow("permission denied");
  });
});

describe("task categories and checklist rollup in PostgreSQL", () => {
  test("finishing every checklist item completes its task; reopening one reopens the task", async () => {
    await db.query("DELETE FROM public.sub_items WHERE parent_type='task' AND parent_id=$1", [
      TASK,
    ]);
    const first = "99999999-9999-4999-8999-999999999991";
    const second = "99999999-9999-4999-8999-999999999992";
    await db.query(
      "INSERT INTO public.sub_items(id,user_id,parent_type,parent_id,title,position) VALUES ($1,$2,'task',$3,'الأول',0),($4,$2,'task',$3,'الثاني',1)",
      [first, ACCOUNT, TASK, second],
    );
    await db.query("UPDATE public.sub_items SET done=true,status='done',progress=100 WHERE id=$1", [
      first,
    ]);
    let task = (
      await db.query<{ done: boolean; status: string; progress: number }>(
        "SELECT done,status,progress FROM public.tasks WHERE id=$1",
        [TASK],
      )
    ).rows[0];
    expect(task).toEqual({ done: false, status: "todo", progress: 50 });
    await db.query("UPDATE public.sub_items SET done=true,status='done',progress=100 WHERE id=$1", [
      second,
    ]);
    task = (await db.query("SELECT done,status,progress FROM public.tasks WHERE id=$1", [TASK]))
      .rows[0] as typeof task;
    expect(task).toEqual({ done: true, status: "done", progress: 100 });
    await db.query("UPDATE public.sub_items SET done=false,status='todo',progress=0 WHERE id=$1", [
      first,
    ]);
    task = (await db.query("SELECT done,status,progress FROM public.tasks WHERE id=$1", [TASK]))
      .rows[0] as typeof task;
    expect(task).toEqual({ done: false, status: "todo", progress: 50 });
  });

  test("adding an unfinished item reopens a previously completed task", async () => {
    await db.query("DELETE FROM public.sub_items WHERE parent_type='task' AND parent_id=$1", [
      TASK,
    ]);
    await db.query("UPDATE public.tasks SET done=true,status='done',progress=100 WHERE id=$1", [
      TASK,
    ]);
    await db.query(
      "INSERT INTO public.sub_items(user_id,parent_type,parent_id,title) VALUES ($1,'task',$2,'بند جديد')",
      [ACCOUNT, TASK],
    );
    expect(
      (await db.query("SELECT done,status,progress FROM public.tasks WHERE id=$1", [TASK])).rows[0],
    ).toEqual({ done: false, status: "todo", progress: 0 });
  });

  test("direct parent completion cannot bypass unfinished checklist items", async () => {
    await db.query("UPDATE public.sub_items SET done=true,status='done',progress=100 WHERE id=$1", [
      CHILD,
    ]);
    await db.query("UPDATE public.tasks SET done=true,status='done',progress=100 WHERE id=$1", [
      TASK,
    ]);
    expect(
      (await db.query("SELECT done,status,progress FROM public.tasks WHERE id=$1", [TASK])).rows[0],
    ).toEqual({ done: false, status: "todo", progress: 50 });
  });

  test("tasks without checklist items remain manually completable", async () => {
    await db.query("DELETE FROM public.sub_items WHERE parent_type='task' AND parent_id=$1", [
      TASK,
    ]);
    await db.query("UPDATE public.tasks SET done=true,status='done',progress=100 WHERE id=$1", [
      TASK,
    ]);
    expect(
      (await db.query("SELECT done,status,progress FROM public.tasks WHERE id=$1", [TASK])).rows[0],
    ).toEqual({ done: true, status: "done", progress: 100 });
  });

  test("legacy checklist rows also prevent premature parent completion", async () => {
    await db.query("DELETE FROM public.sub_items WHERE parent_type='task' AND parent_id=$1", [
      TASK,
    ]);
    await db.query(
      "INSERT INTO public.task_checklist(user_id,task_id,text,done) VALUES ($1,$2,'قديم مكتمل',true),($1,$2,'قديم مفتوح',false)",
      [ACCOUNT, TASK],
    );
    await db.query("UPDATE public.tasks SET done=true,status='done',progress=100 WHERE id=$1", [
      TASK,
    ]);
    expect(
      (await db.query("SELECT done,status,progress FROM public.tasks WHERE id=$1", [TASK])).rows[0],
    ).toEqual({ done: false, status: "todo", progress: 50 });
  });

  test("parent-completion readiness probe verifies the installed trigger", async () => {
    expect(
      (
        await db.query<{ ready: boolean }>(
          "SELECT public.memoflow_task_completion_guard_v1() AS ready",
        )
      ).rows[0].ready,
    ).toBe(true);
    await db.exec("RESET ROLE; SET ROLE anon");
    await expect(db.query("SELECT public.memoflow_task_completion_guard_v1()")).rejects.toThrow(
      "permission denied",
    );
  });

  test("deleting the last checklist item leaves the task open with zero progress", async () => {
    await db.query("DELETE FROM public.sub_items WHERE parent_type='task' AND parent_id=$1", [
      TASK,
    ]);
    await db.query(
      "INSERT INTO public.sub_items(user_id,parent_type,parent_id,title,done,status,progress) VALUES ($1,'task',$2,'وحيد',true,'done',100)",
      [ACCOUNT, TASK],
    );
    await db.query("DELETE FROM public.sub_items WHERE parent_type='task' AND parent_id=$1", [
      TASK,
    ]);
    expect(
      (await db.query("SELECT done,status,progress FROM public.tasks WHERE id=$1", [TASK])).rows[0],
    ).toEqual({ done: false, status: "todo", progress: 0 });
  });

  test("a recurring task advances once and resets its checklist for the next occurrence", async () => {
    await db.query("DELETE FROM public.sub_items WHERE parent_type='task' AND parent_id=$1", [
      TASK,
    ]);
    const due = "2026-10-31T06:30:00.000Z";
    const reminder = "2026-10-31T05:30:00.000Z";
    await db.query(
      "UPDATE public.tasks SET recurrence='monthly',due_at=$2,reminder_at=$3 WHERE id=$1",
      [TASK, due, reminder],
    );
    await db.query(
      "INSERT INTO public.sub_items(user_id,parent_type,parent_id,title,done,status,progress) VALUES ($1,'task',$2,'دورة',true,'done',100)",
      [ACCOUNT, TASK],
    );
    const task = (
      await db.query<{
        done: boolean;
        progress: number;
        due_at: string;
        reminder_at: string;
      }>("SELECT done,progress,due_at,reminder_at FROM public.tasks WHERE id=$1", [TASK])
    ).rows[0];
    expect(task.done).toBe(false);
    expect(task.progress).toBe(0);
    expect(new Date(task.due_at).toISOString()).toBe("2026-11-30T06:30:00.000Z");
    expect(new Date(task.reminder_at).toISOString()).toBe("2026-11-30T05:30:00.000Z");
    expect(
      (
        await db.query<{ done: boolean }>(
          "SELECT done FROM public.sub_items WHERE parent_type='task' AND parent_id=$1",
          [TASK],
        )
      ).rows[0].done,
    ).toBe(false);
  });

  test("cross-account categories, task parents and nested parents are rejected", async () => {
    const noteItem = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
    await db.exec("RESET ROLE");
    const otherCategory = (
      await db.query<{ id: string }>("SELECT id FROM public.categories WHERE user_id=$1 LIMIT 1", [
        OTHER,
      ])
    ).rows[0].id;
    await asUser();
    await expect(
      db.query("UPDATE public.tasks SET category_id=$2 WHERE id=$1", [TASK, otherCategory]),
    ).rejects.toThrow("MF_INVALID_TASK_CATEGORY");
    await expect(
      db.query(
        "INSERT INTO public.sub_items(user_id,parent_type,parent_id,title) VALUES ($1,'task',$2,'غير صالح')",
        [ACCOUNT, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      ),
    ).rejects.toThrow("MF_INVALID_TASK_PARENT");
    await db.query(
      "INSERT INTO public.sub_items(id,user_id,parent_type,parent_id,title) VALUES ($1,$2,'note',$3,'بند مذكرة')",
      [noteItem, ACCOUNT, NOTE],
    );
    await expect(
      db.query(
        "INSERT INTO public.sub_items(user_id,parent_type,parent_id,parent_item_id,depth,title) VALUES ($1,'task',$2,$3,1,'غير صالح')",
        [ACCOUNT, TASK, noteItem],
      ),
    ).rejects.toThrow("MF_INVALID_SUB_ITEM_PARENT");
  });

  test("deleting a task removes its polymorphic checklist rows", async () => {
    expect(
      (
        await db.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM public.sub_items WHERE parent_type='task' AND parent_id=$1",
          [TASK],
        )
      ).rows[0].count,
    ).toBeGreaterThan(0);
    await db.query("DELETE FROM public.tasks WHERE id=$1", [TASK]);
    expect(
      (
        await db.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM public.sub_items WHERE parent_type='task' AND parent_id=$1",
          [TASK],
        )
      ).rows[0].count,
    ).toBe(0);
  });
});
