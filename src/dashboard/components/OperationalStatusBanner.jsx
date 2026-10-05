import { useState } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, Loader2, Info } from "lucide-react";

export default function OperationalStatusBanner({
  loading = false,
  error = null,
  lastUpdated = null,
  modelStatus = null,
  hasRunPredictions = false,
  onRetry = null,
  moduleName = null,
  className = "",
}) {
  const [showTechDetails, setShowTechDetails] = useState(false);

  const statusMap = modelStatus || {};
  const statusValues = Object.values(statusMap);
  const successCount = statusValues.filter((s) => s === "success" || s === "demo" || s === "loaded").length;
  const failedCount = statusValues.filter((s) => s === "error" || s === "failed").length;
  const isPartialFailure = successCount > 0 && failedCount > 0;

  // 1. LOADING STATE
  if (loading) {
    return (
      <div className={`rounded-md border border-blue/30 bg-surface p-4 shadow-soft ${className}`}>
        <div className="flex items-center gap-2 mb-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-blue" />
          <span className="text-[13.5px] font-bold text-navy">Running prediction services...</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-5 pt-1 border-t border-border/60">
          {[
            { key: "forecast", label: "Forecast" },
            { key: "waiting_time", label: "Wait Time" },
            { key: "crowding_risk", label: "Crowding" },
            { key: "flow_pattern", label: "Flow Patterns" },
            { key: "surge_detection", label: "Surge" },
          ].map(({ key, label }) => {
            const st = statusMap[key];
            const isOk = st === "success" || st === "demo" || st === "loaded";
            const isUp = st === "updating" || st === "loading";
            const isErr = st === "error" || st === "failed";
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className="text-navy-soft font-medium">{label}</span>
                <span className={isOk ? "text-teal font-semibold" : isUp ? "text-blue font-semibold animate-pulse" : isErr ? "text-red font-bold" : "text-navy-muted"}>
                  {isOk ? "● Complete" : isUp ? "● Running" : isErr ? "⚠ Failed" : "○ Waiting"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. INITIAL UNUPDATED STATE (Not an error)
  if (!hasRunPredictions && !error && !lastUpdated) {
    return (
      <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-blue/30 bg-surface px-4 py-3 text-[12.5px] text-navy ${className}`}>
        <div className="flex items-center gap-2 font-medium">
          <Info className="h-4 w-4 text-blue shrink-0" />
          <div>
            <span className="font-bold text-navy">Predictions not yet updated</span>
            <span className="hidden sm:inline text-navy-muted"> — Click 'Update All Predictions' to generate the latest forecasts.</span>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-dark transition-colors shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Run Predictions
          </button>
        )}
      </div>
    );
  }

  // 3. PARTIAL FAILURE STATE
  if (error && isPartialFailure) {
    const lastTime = lastUpdated || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return (
      <div className={`rounded-md border border-amber/40 bg-surface p-4 shadow-soft text-navy ${className}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-amber-tint text-amber-dark">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-[13.5px] font-bold text-navy">
                {failedCount} prediction service{failedCount > 1 ? "s require" : " requires"} attention.
              </h3>
              <p className="mt-0.5 text-[12.5px] text-navy-muted leading-relaxed">
                The other prediction services remain operational.
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[11.5px] font-mono text-navy-soft">
                <span>Last successful update: <strong className="text-navy font-semibold">{lastTime}</strong></span>
              </div>
            </div>
          </div>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 shrink-0 rounded-md border border-border bg-bg px-3.5 py-1.5 text-[12.5px] font-semibold text-navy hover:bg-surface transition-colors shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5 text-navy-soft" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4. COMPLETE FAILURE / BACKEND OFFLINE STATE
  if (error) {
    const isTimeout =
      error?.isTimeout ||
      (typeof error === "string" && error.toLowerCase().includes("time")) ||
      (error?.message && error.message.toLowerCase().includes("time"));

    const title = moduleName
      ? `${moduleName} prediction unavailable`
      : isTimeout
      ? "Prediction request is taking longer than expected"
      : "Prediction services are currently unavailable";

    const subtitle = moduleName
      ? "The other prediction services remain operational."
      : isTimeout
      ? "The system is still attempting to reach the prediction service."
      : "Unable to reach backend ML service. The latest operational data remains available.";

    const lastTime = lastUpdated || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const lastLabel = moduleName ? "Last successful result:" : "Last successful update:";

    const statusCode = error?.status || (isTimeout ? 504 : 503);
    const endpoint = error?.endpoint || "/api/predict/all";
    const requestId = error?.requestId || `req-${Math.random().toString(36).substring(2, 9)}`;
    const technicalMsg =
      error?.technicalMessage ||
      (typeof error === "string" ? error : error?.message || "Connection refused by ML backend service.");

    return (
      <div className={`rounded-md border border-red/30 bg-surface p-4 shadow-soft text-navy ${className}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-red-tint text-red">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-[13.5px] font-bold text-navy">{title}</h3>
              <p className="mt-0.5 text-[12.5px] text-navy-muted leading-relaxed">{subtitle}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[11.5px] font-mono text-navy-soft">
                <span>{lastLabel} <strong className="text-navy font-semibold">{lastTime}</strong></span>
              </div>
            </div>
          </div>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 shrink-0 rounded-md border border-border bg-bg px-3.5 py-1.5 text-[12.5px] font-semibold text-navy hover:bg-surface transition-colors shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5 text-navy-soft" />
              <span>Retry</span>
            </button>
          )}
        </div>

        {/* Collapsible Technical Details */}
        <div className="mt-3 pt-2.5 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowTechDetails((prev) => !prev)}
            className="flex items-center gap-1 text-[11.5px] font-medium text-navy-soft hover:text-navy transition-colors"
          >
            <span>{showTechDetails ? "Hide technical details" : "View technical details"}</span>
            {showTechDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showTechDetails && (
            <div className="mt-2.5 rounded bg-bg p-3 border border-border font-mono text-[11px] text-navy-soft space-y-1">
              <div><strong className="text-navy">HTTP Status:</strong> {statusCode}</div>
              <div><strong className="text-navy">Endpoint:</strong> {endpoint}</div>
              <div><strong className="text-navy">Request ID:</strong> {requestId}</div>
              <div className="pt-1 text-red-dark border-t border-border/40 mt-1">
                <strong className="text-navy">Error Detail:</strong> {technicalMsg}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. ALL SUCCESSFUL STATE
  const lastTime = lastUpdated || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-[12.5px] ${className}`}>
      <div className="flex items-center gap-2 font-medium text-navy">
        <span className="h-2 w-2 rounded-full bg-teal" />
        <span className="font-semibold text-teal">● All prediction services updated successfully</span>
      </div>
      <div className="font-mono text-[11.5px] text-navy-soft">
        Last updated: <span className="font-semibold text-navy">{lastTime}</span>
      </div>
    </div>
  );
}
