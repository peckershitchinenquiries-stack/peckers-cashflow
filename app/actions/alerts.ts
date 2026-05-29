"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase, getSessionUser } from "@/lib/supabase-server";
import { writeAudit } from "./audit";
import {
  addDays,
  startOfISOWeek,
  toISODate,
  todayISO,
  shiftHours,
  percentDelta,
} from "@/lib/utils";
import type { AlertType, AlertSeverity } from "@/lib/types";

async function requireAllowed() {
  const user = await getSessionUser();
  if (!user || !user.allowed) throw new Error("Not authorised");
  return user;
}

// =============================================================
// Alert helpers
// =============================================================

async function upsertAlert(input: {
  alert_type: AlertType;
  severity?: AlertSeverity;
  store_id?: string | null;
  employee_id?: string | null;
  shift_id?: string | null;
  title: string;
  message: string;
  payload?: Record<string, unknown> | null;
}) {
  const supabase = createServerSupabase();

  // Don't create a duplicate open alert
  const { data: existing } = await supabase
    .from("alerts")
    .select("id")
    .eq("alert_type", input.alert_type)
    .eq("resolved", false)
    .eq("employee_id", input.employee_id ?? "00000000-0000-0000-0000-000000000000")
    .eq("shift_id", input.shift_id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  if (existing) {
    await supabase
      .from("alerts")
      .update({
        message: input.message,
        payload: input.payload ?? null,
        title: input.title,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("alerts")
    .insert({
      alert_type: input.alert_type,
      severity: input.severity ?? "warning",
      store_id: input.store_id ?? null,
      employee_id: input.employee_id ?? null,
      shift_id: input.shift_id ?? null,
      title: input.title,
      message: input.message,
      payload: input.payload ?? null,
    })
    .select("id")
    .maybeSingle();

  // Suppress duplicate-key errors from the partial unique index
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    console.error("[alerts] insert error", error.message);
  }
  return data?.id ?? null;
}

export async function resolveAlert(input: { id: string; note?: string | null }) {
  const user = await requireAllowed();
  const supabase = createServerSupabase();
  const { error } = await supabase
    .from("alerts")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      resolution_note: input.note?.trim() || null,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  await writeAudit({
    action: "resolve",
    entity: "alert",
    entity_id: input.id,
    changes: { note: input.note ?? null },
  });
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  return { ok: true };
}

// =============================================================
// Scan & generate alerts based on current data.
// =============================================================
export async function scanForAlerts() {
  await requireAllowed();
  const supabase = createServerSupabase();

  const today = todayISO();
  const weekStart = toISODate(startOfISOWeek(new Date()));
  const fourWeeksAgo = toISODate(addDays(new Date(), -28));

  const [shiftsRes, clocksRes, employeesRes, deliveriesRes] = await Promise.all([
    supabase
      .from("rota_shifts")
      .select("*")
      .gte("shift_date", fourWeeksAgo)
      .lte("shift_date", today)
      .order("shift_date"),
    supabase
      .from("clock_events")
      .select("*")
      .gte("event_date", fourWeeksAgo)
      .lte("event_date", today),
    supabase.from("employees").select("*"),
    supabase
      .from("weekly_deliveries")
      .select("*")
      .gte("week_start_date", fourWeeksAgo),
  ]);

  const shifts = shiftsRes.data ?? [];
  const clocks = clocksRes.data ?? [];
  const employees = employeesRes.data ?? [];
  const deliveries = deliveriesRes.data ?? [];

  const employeeById = new Map(employees.map((e) => [e.id, e]));

  // -------- wage_variance: this-week vs 4-week avg hours per employee --------
  const hoursByEmpWeek = new Map<string, Map<string, number>>();
  for (const s of shifts) {
    if (s.is_day_off) continue;
    const map = hoursByEmpWeek.get(s.employee_id) ?? new Map<string, number>();
    const wk = toISODate(startOfISOWeek(new Date(s.shift_date)));
    map.set(wk, (map.get(wk) ?? 0) + Number(s.scheduled_hours ?? 0));
    hoursByEmpWeek.set(s.employee_id, map);
  }

  for (const [empId, weeks] of Array.from(hoursByEmpWeek.entries())) {
    const emp = employeeById.get(empId);
    if (!emp) continue;
    const thisWeek = weeks.get(weekStart) ?? 0;
    const priorWeeks = Array.from(weeks.entries())
      .filter(([wk]) => wk !== weekStart)
      .slice(-4)
      .map(([, h]) => h);
    if (priorWeeks.length < 2) continue;
    const avg = priorWeeks.reduce((a, b) => a + b, 0) / priorWeeks.length;
    const delta = percentDelta(thisWeek, avg);
    if (Math.abs(delta) > 20) {
      await upsertAlert({
        alert_type: "wage_variance",
        severity: "warning",
        store_id: emp.store_id,
        employee_id: emp.id,
        title: `${emp.name}: hours vary ${delta > 0 ? "+" : ""}${delta.toFixed(0)}%`,
        message: `Scheduled ${thisWeek.toFixed(1)}h this week vs ${avg.toFixed(1)}h 4-week average (>20% deviation).`,
        payload: { this_week: thisWeek, avg_4wk: avg, delta_percent: delta },
      });
    }
  }

  // -------- delivery_unassigned: live driver count > vita mojo count --------
  for (const wd of deliveries) {
    if (wd.vita_mojo_count != null && wd.manager_avg_4wk != null) {
      const live = Number(wd.manager_avg_4wk);
      const vita = Number(wd.vita_mojo_count);
      if (live - vita > 0 && !wd.reason) {
        const driver = employeeById.get(wd.driver_id);
        await upsertAlert({
          alert_type: "delivery_unassigned",
          severity: "warning",
          store_id: wd.store_id,
          employee_id: wd.driver_id,
          title: `${driver?.name ?? "Driver"}: ${live - vita} unassigned deliveries`,
          message: `Live driver count (${live}) exceeds Vita Mojo total (${vita}). Reason required.`,
          payload: { live, vita, week: wd.week_start_date },
        });
      }
    }
  }

  // -------- delivery_payout_high: this-week deliveries > 1.5x 4-week avg per driver --------
  const deliveriesByDriverWeek = new Map<string, Map<string, number>>();
  for (const ce of clocks) {
    if (!ce.deliveries_count) continue;
    const map = deliveriesByDriverWeek.get(ce.employee_id) ?? new Map<string, number>();
    const wk = toISODate(startOfISOWeek(new Date(ce.event_date)));
    map.set(wk, (map.get(wk) ?? 0) + Number(ce.deliveries_count));
    deliveriesByDriverWeek.set(ce.employee_id, map);
  }
  for (const [driverId, weeks] of Array.from(deliveriesByDriverWeek.entries())) {
    const driver = employeeById.get(driverId);
    if (!driver || driver.position !== "Driver") continue;
    const thisWeek = weeks.get(weekStart) ?? 0;
    const priorWeeks = Array.from(weeks.entries())
      .filter(([wk]) => wk !== weekStart)
      .slice(-4)
      .map(([, c]) => c);
    if (priorWeeks.length < 2) continue;
    const avg = priorWeeks.reduce((a, b) => a + b, 0) / priorWeeks.length;
    if (thisWeek > 0 && thisWeek > avg * 1.5) {
      await upsertAlert({
        alert_type: "delivery_payout_high",
        severity: "warning",
        store_id: driver.store_id,
        employee_id: driver.id,
        title: `${driver.name}: high delivery count this week`,
        message: `${thisWeek} deliveries this week vs ${avg.toFixed(0)} 4-week average.`,
        payload: { this_week: thisWeek, avg_4wk: avg },
      });
    }
  }

  // -------- late_clock_in / unexpected_absence (today) --------
  const todayShifts = shifts.filter((s) => s.shift_date === today && !s.is_day_off);
  const todayClocks = new Map(
    clocks.filter((c) => c.event_date === today).map((c) => [c.employee_id, c]),
  );
  const now = new Date();
  for (const s of todayShifts) {
    if (!s.start_time) continue;
    const emp = employeeById.get(s.employee_id);
    if (!emp) continue;
    const [hh, mm] = s.start_time.split(":").map(Number);
    const scheduledStart = new Date();
    scheduledStart.setHours(hh, mm, 0, 0);
    const diffMin = (now.getTime() - scheduledStart.getTime()) / 60000;
    const clk = todayClocks.get(s.employee_id);

    if (!clk?.clock_in_at) {
      if (diffMin > 60 && !s.same_day_edit_reason) {
        await upsertAlert({
          alert_type: "unexpected_absence",
          severity: "critical",
          store_id: s.store_id,
          employee_id: emp.id,
          shift_id: s.id,
          title: `${emp.name}: unexpected absence`,
          message: `Scheduled at ${s.start_time} but not clocked in (${Math.round(diffMin)}m late). No reason recorded.`,
          payload: { scheduled_start: s.start_time, late_minutes: diffMin },
        });
      } else if (diffMin > 15) {
        await upsertAlert({
          alert_type: "late_clock_in",
          severity: "warning",
          store_id: s.store_id,
          employee_id: emp.id,
          shift_id: s.id,
          title: `${emp.name}: late clock-in`,
          message: `Scheduled at ${s.start_time} — ${Math.round(diffMin)}m late.`,
          payload: { scheduled_start: s.start_time, late_minutes: diffMin },
        });
      }
    } else if (clk.clock_out_at && s.end_time) {
      const [eh, em] = s.end_time.split(":").map(Number);
      const scheduledEnd = new Date(s.shift_date);
      scheduledEnd.setHours(eh, em, 0, 0);
      const actualEnd = new Date(clk.clock_out_at);
      const earlyMin = (scheduledEnd.getTime() - actualEnd.getTime()) / 60000;
      if (earlyMin > 30 && !s.same_day_edit_reason) {
        await upsertAlert({
          alert_type: "early_clock_out",
          severity: "warning",
          store_id: s.store_id,
          employee_id: emp.id,
          shift_id: s.id,
          title: `${emp.name}: early clock-out`,
          message: `Clocked out ${Math.round(earlyMin)}m before scheduled end (${s.end_time}). No reason entered.`,
          payload: { scheduled_end: s.end_time, early_minutes: earlyMin },
        });
      }
    }

    // scheduled vs actual variance (only for completed shifts)
    if (clk?.clock_in_at && clk.clock_out_at) {
      const actualHours =
        (new Date(clk.clock_out_at).getTime() - new Date(clk.clock_in_at).getTime()) /
        3_600_000;
      const scheduled = Number(s.scheduled_hours ?? shiftHours(s.start_time, s.end_time));
      if (scheduled > 0) {
        const delta = percentDelta(actualHours, scheduled);
        if (Math.abs(delta) > 25) {
          await upsertAlert({
            alert_type: "scheduled_vs_actual",
            severity: "info",
            store_id: s.store_id,
            employee_id: emp.id,
            shift_id: s.id,
            title: `${emp.name}: scheduled vs actual variance`,
            message: `Worked ${actualHours.toFixed(1)}h vs ${scheduled.toFixed(1)}h scheduled (${delta > 0 ? "+" : ""}${delta.toFixed(0)}%).`,
            payload: { actual: actualHours, scheduled, delta_percent: delta },
          });
        }
      }
    }
  }

  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  return { ok: true };
}
