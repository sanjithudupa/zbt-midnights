import { getServiceSupabase } from "./supabaseServer";

export async function getAdminSetting(key: string) {
  const secret = process.env.ADMIN_SETTINGS_SECRET;
  if (!secret) {
    throw new Error("Missing ADMIN_SETTINGS_SECRET.");
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("value_encrypted")
    .eq("key", key)
    .single();

  if (error || !data?.value_encrypted) return null;

  const { data: decrypted } = await supabase.rpc("decrypt_setting", {
    encrypted: data.value_encrypted,
    secret_text: secret,
  });

  return decrypted ?? null;
}

export async function setAdminSetting(key: string, value: string) {
  const secret = process.env.ADMIN_SETTINGS_SECRET;
  if (!secret) {
    throw new Error("Missing ADMIN_SETTINGS_SECRET.");
  }

  const supabase = getServiceSupabase();
  const { data: encrypted, error: encryptError } = await supabase.rpc(
    "encrypt_setting",
    {
      plain_text: value,
      secret_text: secret,
    }
  );

  if (encryptError || !encrypted) {
    throw new Error("Failed to encrypt setting.");
  }

  const { error } = await supabase.from("admin_settings").upsert({
    key,
    value_encrypted: encrypted,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error("Failed to store setting.");
  }
}
