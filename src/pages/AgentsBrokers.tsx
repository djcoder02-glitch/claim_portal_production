import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Agents } from "./Agents";
import { Brokers } from "./Brokers";

export const AgentsBrokers = () => {
  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="brokers" className="w-full">
        <div className="border-b bg-card px-8 pt-6">
          <TabsList className="w-full justify-start h-12 bg-transparent border-0">
            <TabsTrigger value="brokers" className="text-base">
              Brokers
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-base">
              Agents
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="brokers" className="mt-0 p-8">
          <Brokers />
        </TabsContent>
        <TabsContent value="agents" className="mt-0 p-8">
          <Agents />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentsBrokers;