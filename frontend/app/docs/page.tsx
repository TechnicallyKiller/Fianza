import DocContent from "@/components/DocContent";
import { readDoc } from "@/lib/docs";

export const metadata = { title: "Docs — TrustLine" };

export default function DocsIndexPage() {
  const markdown = readDoc("README");
  return <DocContent markdown={markdown} />;
}
