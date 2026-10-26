import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { auth, sessionPersistence } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (sessionPersistence.expired()) await auth.signOut();
    const user = await auth.getUser();
    if (!user) throw redirect({ to: "/auth", search: { redirect: location.href } });
    return { user };
  },
  component: () => <Outlet />,
});
