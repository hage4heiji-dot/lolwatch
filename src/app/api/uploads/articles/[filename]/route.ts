import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

// アップロード済み記事画像の配信用。public/配下への静的配置に頼らない理由:
// このNext.jsのバージョンはpublicフォルダの内容をサーバー起動時にスキャンして
// 固定するらしく、起動後にアップロードされたファイルがサーバー再起動まで404に
// なってしまう挙動を確認したため、Route Handlerでリクエストのたびにファイルを
// 読みに行く方式に切り替えた。
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "articles");

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

// アップロード時にrandomUUID()+既知の拡張子で生成したファイル名のみを想定しており、
// パストラバーサルを避けるため厳密なパターンに一致しないリクエストは拒否する。
const FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop()!;
  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext],
        // ファイル名がrandomUUID()ベースで同名別内容になり得ないため、長期キャッシュ可能。
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
