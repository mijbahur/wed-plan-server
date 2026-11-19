import { env } from "../lib/env.js";

export async function uploadToImgBB(file) {
  if (!env.IMGBB_API_KEY) {
    throw new Error("IMGBB_API_KEY is not configured.");
  }

  const body = new URLSearchParams({
    key: env.IMGBB_API_KEY,
    image: file.buffer.toString("base64"),
    name: file.originalname,
  });

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body,
  });

  const result = await response.json();

  if (!response.ok || !result.success || !result.data?.url) {
    throw new Error("ImgBB rejected the image upload.");
  }

  return result.data.url;
}
