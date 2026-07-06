import { notFound } from "next/navigation";
import DocContent from "@/components/DocContent";
import { allDocSlugs, getDocTitle, readDoc } from "@/lib/docs";

export function generateStaticParams() {
  return allDocSlugs()
    .filter((slug) => slug !== "README")
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `${getDocTitle(slug)} — TrustLine docs` };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!allDocSlugs().includes(slug)) notFound();
  let markdown: string;
  try {
    markdown = readDoc(slug);
  } catch {
    notFound();
  }
  return <DocContent markdown={markdown} />;
}
