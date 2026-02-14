"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Radio } from "lucide-react";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { PingDot } from "@/hooks/useVaultHistory";

interface SessionActivityCardProps {
  pingStatus: string;
  loading: string | null;
  hasSessionKey: boolean;
  onPing: () => void;
  pingDots: PingDot[];
}

const chartConfig = {
  count: {
    label: "Pings",
    color: "hsl(var(--chart-3))",
  },
};

export function SessionActivityCard({
  pingStatus,
  loading,
  hasSessionKey,
  onPing,
  pingDots,
}: SessionActivityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-chart-3" />
          Session Activity
        </CardTitle>
        <CardDescription>
          Test ping via session key — requires funded smart account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={onPing}
          disabled={loading !== null || !hasSessionKey}
          variant="default"
          className="w-full"
        >
          {loading === "ping" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Pinging…
            </>
          ) : (
            "Test Ping"
          )}
        </Button>

        {pingStatus && (
          <div className="flex items-start gap-2">
            {pingStatus.startsWith("Success") ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 text-xs shrink-0">
                Success
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs shrink-0">
                Error
              </Badge>
            )}
            <p className="text-xs text-muted-foreground break-all">{pingStatus}</p>
          </div>
        )}

        {pingDots.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total pings: {pingDots.length}</p>
          </div>
        )}

        {pingDots.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[120px] w-full">
            <LineChart data={pingDots} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={10} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--color-count)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--color-count)" }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-xs text-muted-foreground">No pings yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
