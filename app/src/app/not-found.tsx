import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * The likeliest visitor here is not a stranger guessing addresses. It is a
 * wholesale buyer who was sent a link, opened it a week later, and found the
 * style withdrawn or the selection gone. So this says the address is dead and
 * offers the catalog, rather than reading as a fault on their side.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24 text-center">
      <Image
        src="/logo.png"
        alt="itoo"
        width={1050}
        height={483}
        priority
        className="mx-auto h-8 w-auto"
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">This link no longer opens</h1>
        <p className="text-sm text-muted-foreground">
          The style may have been withdrawn, or the selection it pointed at was
          put together for someone else. The full catalog is still here.
        </p>
      </div>
      <Button asChild className="mx-auto">
        <Link href="/">View the catalog</Link>
      </Button>
    </main>
  );
}
