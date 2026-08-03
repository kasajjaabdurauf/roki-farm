"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { FarmerForm } from "@/components/farmers/FarmerForm";
import { Card } from "@/components/ui";

export default function NewFarmerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/farmers" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-stone-500 hover:text-forest-800">
        <ArrowLeft className="h-4 w-4" /> All farmers
      </Link>
      <div>
        <h2 className="font-display text-2xl font-semibold text-forest-900">Register Farmer</h2>
        <p className="mt-0.5 text-sm text-stone-500">
          A system ID (RFV-UG-XXXXX) is auto-generated and the rule engine immediately scores the farmer (Roki tier, scale tier, profile flags).
        </p>
      </div>
      <Card className="p-6">
        <FarmerForm />
      </Card>
    </div>
  );
}
