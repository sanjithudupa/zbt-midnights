import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const apiKey = process.env.IMG_BB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ImgBB key." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadForm = new FormData();
  uploadForm.append("key", apiKey);
  uploadForm.append("image", buffer.toString("base64"));

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: uploadForm,
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to upload image." },
      { status: 502 }
    );
  }

  const payload = await response.json();
  const url = payload?.data?.url as string | undefined;

  if (!url) {
    return NextResponse.json(
      { error: "Invalid upload response." },
      { status: 502 }
    );
  }

  return NextResponse.json({ url });
}
