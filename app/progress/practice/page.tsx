import { ProgressPracticePage } from "@/components/ProgressPracticePage";

type ProgressPracticeRouteProps = {
  searchParams?: {
    subject?: string | string[];
    tag?: string | string[];
    yearFrom?: string | string[];
    yearTo?: string | string[];
  };
};

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ProgressPracticeRoute({ searchParams }: ProgressPracticeRouteProps) {
  return (
    <ProgressPracticePage
      subjectParam={getFirstParam(searchParams?.subject)}
      primaryTagParam={getFirstParam(searchParams?.tag)}
      yearFromParam={getFirstParam(searchParams?.yearFrom)}
      yearToParam={getFirstParam(searchParams?.yearTo)}
    />
  );
}
