"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, CheckCircle2, XCircle } from "lucide-react";
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
  const isSuccess = pingStatus.startsWith("Success");
  const hasPings = pingDots.length > 0;

  return (
    <Card className="overflow-hidden transition-all duration-300">
      <CardContent className="p-5">
        {/* Top row: icon + title + count */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-3/15">
              <Radio className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Activity</h3>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                Test session key connection.
              </p>
            </div>
          </div>
          {hasPings && (
            <span className="shrink-0 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums">
              {pingDots.length} pings
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="my-4 h-px bg-border/50" />

        {/* Status indicator */}
        {pingStatus ? (
          <div className="flex items-start gap-2.5 animate-in fade-in-0 duration-200">
            {isSuccess ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            )}
            <p className="min-w-0 text-[12px] leading-relaxed text-muted-foreground break-all line-clamp-2">
              {pingStatus}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1 text-muted-foreground/50">
            <Radio className="h-4 w-4" />
            <span className="text-[12px]">No pings yet — press Test Ping to start.</span>
          </div>
        )}

        {/* Action */}
        <Button
          onClick={onPing}
          disabled={loading !== null || !hasSessionKey}
          variant="outline"
          className="mt-3 w-full transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
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

        {/* Chart footer */}
        {hasPings && (
          <>
            <div className="my-3 h-px bg-border/50" />
            <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
              <ChartContainer config={chartConfig} className="h-[64px] w-full">
                <LineChart data={pingDots} accessibilityLayer>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={9} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={1.5}
                    dot={{ r: 2.5, fill: "var(--color-count)" }}
                  />
                </LineChart>
              </ChartContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
