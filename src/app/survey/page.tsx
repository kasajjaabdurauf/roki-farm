"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { FarmerForm } from "@/components/farmers/FarmerForm";
import { useDb } from "@/lib/db";
import { Card } from "@/components/ui";

/**
 * Farmer self-registration survey.
 * A farmer who hasn't been registered yet can complete the official
 * questionnaire here; finishing creates their profile and links it to
 * their account automatically. Staff-only route logic is enforced by
 * the navigation, and this page guides the right role.
 */
export default function SurveyPage() {
  const db = useDb();

  // staff don't use self-registration — point them to the staff survey
  if (db.meta.role !== "FARMER") {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-6">
        <Card className="p-6 text-center">
          <p className="font-display text-lg font-semibold text-forest-900">Farmer registration survey</p>
          <p className="mt-1 text-sm text-stone-500">
            This page is for farmers completing their own registration. Staff register farmers from{" "}
            <Link href="/farmers/new" className="font-semibold text-forest-700 underline">Farmers → New Survey</Link>.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-stone-500 hover:text-forest-800">
        <ArrowLeft className="h-4 w-4" /> My dashboard
      </Link>
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-forest-900">
          <ClipboardList className="h-6 w-6 text-ochre-500" /> Farmer registration survey
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          The official Roki questionnaire, about 10 minutes. Finish it once and your farm is registered; you can
          review it anytime afterwards.
        </p>
      </div>
      <Card className="p-5 sm:p-6">
        <FarmerForm selfRegistration />
      </Card>
    </div>
  );
}
