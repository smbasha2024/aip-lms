import { notFound } from "next/navigation";
import { TeamMemberScreen } from "@/features/team/TeamMemberScreen";
export default async function Page({ params }: { params: Promise<{ employeeId: string }> }) { const { employeeId } = await params; if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) notFound(); return <TeamMemberScreen id={employeeId}/>; }
