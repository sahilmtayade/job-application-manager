import { Header } from "@/components/layout/header";
import { ApplicationForm } from "@/components/applications/application-form";

export default function NewApplicationPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Add Application" />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-2xl">
          <ApplicationForm mode="create" />
        </div>
      </div>
    </div>
  );
}

