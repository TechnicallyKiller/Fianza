import TLNav from "@/components/tl/TLNav";
import DocsSidebar from "@/components/DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tl-select relative z-10 min-h-screen bg-obsidian text-bone">
      <TLNav />
      <div className="mx-auto flex max-w-[1440px] gap-10 px-6 py-10 md:px-10">
        <DocsSidebar />
        <main className="min-w-0 flex-1 pb-24">{children}</main>
      </div>
    </div>
  );
}
