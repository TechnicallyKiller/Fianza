import TLNav from "@/components/tl/TLNav";
import DocsSidebar from "@/components/DocsSidebar";
import MobileDocsNav from "@/components/docs/MobileDocsNav";
import ScrollProgress from "@/components/tl/ScrollProgress";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tl-select relative z-10 min-h-screen bg-obsidian text-bone">
      <ScrollProgress />
      <TLNav />
      <div className="mx-auto flex max-w-[1440px] gap-10 px-6 py-10 md:px-10">
        <DocsSidebar />
        <main className="min-w-0 flex-1 pb-24">
          <MobileDocsNav />
          {children}
        </main>
      </div>
    </div>
  );
}
