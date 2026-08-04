"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardPlus } from "lucide-react";
import { FarmerForm } from "@/components/farmers/FarmerForm";
import { Card } from "@/components/ui";

export default function NewFarmerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/farmers" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-stone-500 hover:text-forest-800">
        <ArrowLeft className="h-4 w-4" /> All farmers
      </Link>
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-forest-900">
          <ClipboardPlus className="h-6 w-6 text-ochre-500" /> Register Farmer
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Fill in the survey with the farmer — a system ID (RFV-UG-XXXXX) is auto-generated and the rule engine
          immediately scores the farmer. No account needed; the farmer can claim their record later with their
          phone or email.
        </p>
      </div>
      <Card className="p-5 sm:p-6">
        <FarmerForm />
      </Card>
    </div>
  );
}
