import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireModerator } from "@/lib/moderatorAuth";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// アップロード先。public/配下に置くことでNext.jsの静的配信をそのまま使う。
// docker-compose.ymlでこのディレクトリを名前付きVolumeにマウントし、
// イメージ再ビルド(コンテナ再作成)を跨いでも投稿済み画像が消えないようにしている。
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "articles");

export async function POST(request: NextRequest) {
  await requireModerator();

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "画像ファイルを選択してください。" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "対応していない画像形式です(png/jpeg/webp/gifのみ)。" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "画像サイズは5MB以内にしてください。" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return NextResponse.json({ ok: true, url: `/uploads/articles/${filename}` }, { status: 201 });
}
