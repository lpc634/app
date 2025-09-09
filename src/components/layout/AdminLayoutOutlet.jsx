import { Outlet } from "react-router-dom";
import Layout from "@/Layout.jsx";
import MobileShell from "@/components/layout/MobileShell.jsx";
import { PageHeaderProvider } from "@/components/layout/PageHeaderContext.jsx";

export default function AdminLayoutOutlet() {
  return (
    <PageHeaderProvider>
      <div className="md:hidden">
        <MobileShell />
      </div>
      <div className="hidden md:block">
        <Layout>
          <Outlet />
        </Layout>
      </div>
    </PageHeaderProvider>
  );
}


