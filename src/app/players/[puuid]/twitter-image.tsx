export { default, size, contentType, alt } from "./opengraph-image";

// revalidateはNext.jsがファイル単位で静的解析するため、re-exportでなくここでも直接宣言する。
export const revalidate = 3600;
