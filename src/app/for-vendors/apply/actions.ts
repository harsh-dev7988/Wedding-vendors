"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  describeDatabaseError,
  fieldErrorsFromZod,
  formValues,
  invalid,
  type ActionState,
} from "@/lib/action-result";
import { requireViewer } from "@/lib/auth";
import { normalizeIndianPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

const applicationSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Enter your business name.")
    .max(160, "Business names are limited to 160 characters."),
  email: z.union([
    z.literal(""),
    z.email("Enter a valid email address.").max(254),
  ]),
  phone: z.string().trim().min(8, "Enter a contact number.").max(24),
});

const FIELDS = ["businessName", "email", "phone"] as const;

export async function startVendorApplication(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireViewer("/for-vendors/apply");
  const values = formValues(formData, FIELDS);

  const parsed = applicationSchema.safeParse({
    businessName: formData.get("businessName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    });
  }

  const phone = normalizeIndianPhone(parsed.data.phone);
  if (!phone) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: {
        phone:
          "Enter a 10-digit Indian mobile number, or an international number starting with +.",
      },
      values,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_vendor_application", {
    requested_business_name: parsed.data.businessName,
    requested_email: parsed.data.email || null,
    requested_phone_e164: phone,
  });

  if (error) {
    return invalid(
      describeDatabaseError(
        error,
        "We couldn’t create the workspace. Please try again shortly.",
      ),
      { values },
    );
  }

  redirect("/vendor/dashboard?notice=application-created");
}
