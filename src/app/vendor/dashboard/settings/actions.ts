"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  describeDatabaseError,
  fieldErrorsFromZod,
  formValues,
  invalid,
  succeeded,
  type ActionState,
} from "@/lib/action-result";
import { requireViewer } from "@/lib/auth";
import { normalizeIndianPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Enter your business name.")
    .max(160, "Business names are limited to 160 characters."),
  email: z.union([
    z.literal(""),
    z.email("Enter a valid email address.").max(254),
  ]),
  legalName: z.string().trim().max(200).optional().default(""),
  phone: z.string().trim().min(8, "Enter a contact number.").max(24),
  vendorId: z.uuid(),
  whatsapp: z.string().trim().max(24).optional().default(""),
});

const FIELDS = [
  "businessName",
  "email",
  "legalName",
  "phone",
  "whatsapp",
] as const;

/**
 * Update the business profile and its private contact details.
 *
 * These are the values released to a customer after a validated enquiry, so a
 * vendor being unable to correct a wrong number meant every future reveal
 * handed out a dead contact. Only owners and managers may change them, enforced
 * both here and by the `owners manage contacts` policy.
 */
export async function updateVendorSettings(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireViewer("/vendor/dashboard/settings");
  const values = formValues(formData, FIELDS);

  const parsed = settingsSchema.safeParse({
    businessName: formData.get("businessName"),
    email: formData.get("email"),
    legalName: formData.get("legalName") ?? "",
    phone: formData.get("phone"),
    vendorId: formData.get("vendorId"),
    whatsapp: formData.get("whatsapp") ?? "",
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

  const whatsapp = parsed.data.whatsapp
    ? normalizeIndianPhone(parsed.data.whatsapp)
    : null;
  if (parsed.data.whatsapp && !whatsapp) {
    return invalid("Please correct the highlighted fields.", {
      fieldErrors: {
        whatsapp: "Enter a valid WhatsApp number, or leave blank.",
      },
      values,
    });
  }

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("vendor_members")
    .select("role")
    .eq("vendor_id", parsed.data.vendorId)
    .eq("user_id", viewer.id)
    .maybeSingle();

  if (
    !membership ||
    !["owner", "manager"].includes(membership.role as string)
  ) {
    return invalid(
      "Your role on this business does not allow changing these details.",
      { values },
    );
  }

  const { data: updatedVendor, error: vendorError } = await supabase
    .from("vendors")
    .update({
      business_name: parsed.data.businessName,
      legal_name: parsed.data.legalName || null,
    })
    .eq("id", parsed.data.vendorId)
    .select("id");

  if (vendorError || !updatedVendor?.length) {
    return invalid(
      describeDatabaseError(
        vendorError,
        "Those details could not be saved. Please try again.",
      ),
      { values },
    );
  }

  const { data: updatedContact, error: contactError } = await supabase
    .from("vendor_contacts")
    .update({
      email: parsed.data.email || null,
      phone_e164: phone,
      whatsapp_e164: whatsapp,
    })
    .eq("vendor_id", parsed.data.vendorId)
    .select("vendor_id");

  if (contactError || !updatedContact?.length) {
    return invalid(
      describeDatabaseError(
        contactError,
        "Your contact details could not be saved. Please try again.",
      ),
      { values },
    );
  }

  revalidatePath("/vendor/dashboard/settings");
  revalidatePath("/vendor/[slug]", "page");

  return succeeded(
    "Saved. Updated contact details are used for every future enquiry reveal.",
  );
}
