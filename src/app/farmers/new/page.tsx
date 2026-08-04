"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { FarmerForm } from "@/components/farmers/FarmerForm";

export default function NewFarmerPage() {
  const [agentSession, setAgentSession] = useState(false);
  useEffect(() => {
    try {
      setAgentSession(localStorage.getItem("roki-agent-session") === "1");
    } catch { /* ignore */ }
  }, []);

  // Access-code agents can VIEW everything, but registering farmers writes
  // to the cloud, which needs a signed-in account. Prompt them to sign in
  // (their admin can assign the FIELD_AGENT role).
  if (agentSession) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <Card className="p-6 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ochre-50 text-ochre-700">
            <KeyRound className="h-6 w-6" />
          </span>
          <p className="font-display text-lg font-semibold text-forest-900">Sign in to register farmers</p>
          <p className="mt-1 text-sm leading-relaxed text-stone-500">
            You're in agent view with the access code, which lets you see everything. To register farmers and save
            to the cloud, sign in with your Roki account (an admin can assign you the Field Agent role), or guide
            the farmer to complete their own survey.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/login">
              <Button variant="primary">Sign in</Button>
            </Link>
            <Link href="/farmers">
              <Button variant="outline">Back to farmers</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

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
