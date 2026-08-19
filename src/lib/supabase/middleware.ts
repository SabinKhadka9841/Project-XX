import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Invite links are the one thing under /projects a signed-out person
  // is *supposed* to reach: that page shows what they've been invited
  // to and signs them in on the spot. Bouncing them to a bare login
  // screen first was throwing away the context that makes them join at
  // all. The page itself still requires sign-in before touching
  // anything — it only reveals the project's name.
  const isInviteLink = /^\/projects\/[^/]+\/join\/?$/.test(pathname);

  if (!user && pathname.startsWith("/projects") && !isInviteLink) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Come back here once they're signed in, instead of dumping them on
    // a generic list and making them find their way.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
