"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, LogOut, RefreshCw, ShieldCheck, User, UserCog, Users } from "lucide-react";
import { resetDemoData, setRole, syncNow, useDb } from "@/lib/db";
import { getSession, remoteConfigured, signOut } from "@/lib/remote";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { Badge, Button, Card, Select } from "@/components/ui";
import { cx } from "@/lib/format";

export default function AccountPage() {
  const db = useDb();
  const router = useRouter();
  const isRemote = remoteConfigured();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ role: string; farmer_id: string | null } | null>(null);

  useEffect(() => {
    if (!isRemote) return;
    getSession().then((s) => setEmail(s?.user?.email ?? null));
    import("@/lib/remote").then(async (m) => {
      const p = await m.fetchMyProfile();
      setProfile(p as { role: string; farmer_id: string | null } | null);
    });
  }, [isRemote]);

  const linkedFarmer = useMemo(
    () => (profile?.farmer_id ? db.farmers.find((f) => f.id === profile.farmer_id) : undefined),
    [profile, db.farmers]
  );

  async function doSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold text-forest-900">Account</h2>
        <p className="mt-0.5 text-sm text-stone-500">
          {isRemote ? "Your sign-in details and role" : "Demo mode: explore any role, or sign in for your real account"}
        </p>
      </div>

      {/* ---------- signed-in (production) ---------- */}
      {isRemote && (
        <Card>
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-forest-800 text-white">
              <User className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold text-forest-900">{email ?? "Loading…"}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone="forest" dot>{ROLE_LABEL[(profile?.role as Role) ?? db.meta.role] ?? "Field Agent"}</Badge>
                {linkedFarmer && (
                  <Badge tone="ochre">{linkedFarmer.fullName} · {linkedFarmer.id}</Badge>
                )}
              </div>
              <p className="mt-2 text-[12.5px] text-stone-500">
                Role and access are assigned by your administrator. You only ever see the data your role allows.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
            <Button variant="outline" onClick={() => void syncNow()}>
              <RefreshCw className="h-4 w-4" /> Sync now
            </Button>
            <Button variant="danger" onClick={() => void doSignOut()}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </Card>
      )}

      {/* ---------- demo mode ---------- */}
      {!isRemote && (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
            <UserCog className="h-5 w-5 text-ochre-500" /> Demo mode
          </h3>
          <p className="mb-4 text-[13px] leading-relaxed text-stone-500">
            No account is connected, so you're exploring with sample data. Pick a persona to see exactly what that
            role experiences. (This is the only place the persona switcher lives.)
          </p>
          <div className="mb-4">
            <p className="mb-1.5 text-[13px] font-semibold text-stone-600">Viewing as</p>
            <Select
              value={db.meta.role}
              onChange={(e) => {
                setRole(e.target.value as Role);
                router.push(e.target.value === "FARMER" ? "/farm" : "/");
              }}
            >
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void syncNow()}>
              <RefreshCw className="h-4 w-4" /> Sync now
            </Button>
            <Button variant="ghost" className="text-danger-600 hover:bg-danger-50" onClick={resetDemoData}>
              Reset demo data
            </Button>
          </div>
          <div className="mt-4 rounded-xl bg-forest-50 px-3.5 py-3">
            <p className="text-[12.5px] leading-snug text-forest-800">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              In production, accounts are created by signing up, and the administrator assigns roles from
              <b> Settings → Team &amp; roles</b>. No one switches roles after that.
            </p>
          </div>
        </Card>
      )}

      {/* ---------- what your role can do ---------- */}
      <Card>
        <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-forest-900">
          <BadgeCheck className="h-5 w-5 text-ochre-500" /> What your role includes
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <RoleCard
            title="Admin"
            items={["Full farmer database", "Team & roles management", "Settings, rules & thresholds", "Master backups & exports", "Forecast & supply planning"]}
          />
          <RoleCard
            title="Field agent"
            items={["Register farmers (full survey)", "Log & edit harvests", "Bulk uploads", "Forecast & supply views", "Offline-first field work"]}
          />
          <RoleCard
            title="Farmer"
            items={["My Farm profile", "Log my own harvests", "My harvest history & tier", "Help & support guide"]}
          />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-stone-400">
          <Users className="h-3.5 w-3.5" /> Farmers never see other farmers' data; row-level security enforces this in the database.
        </p>
      </Card>
    </div>
  );
}

function RoleCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
      <p className="mb-2 text-[13px] font-bold text-forest-800">{title}</p>
      <ul className="space-y-1 text-[12px] leading-snug text-stone-600">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-1.5">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-ochre-500" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
