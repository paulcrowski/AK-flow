import React, { useState, useEffect, useRef } from 'react';
import { ConfessionReport, PacketType, AgentType } from '../types';
import { eventBus } from '../core/EventBus';
import { ShieldCheck, AlertTriangle, CheckCircle, HelpCircle, AlertOctagon, Scale } from 'lucide-react';

export const ConfessionLog: React.FC = () => {
    const [reports, setReports] = useState<ConfessionReport[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);

    useEffect(() => {
        const history = eventBus.getHistory();
        const existingReports = history
            .filter(p => p.type === PacketType.CONFESSION_REPORT)
            .map(p => p.payload as ConfessionReport);

        setReports(existingReports);

        const unsubscribe = eventBus.subscribe(PacketType.CONFESSION_REPORT, (packet) => {
            setReports(prev => [...prev.slice(-49), packet.payload as ConfessionReport]); // Keep last 50
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const onScroll = () => {
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
            shouldAutoScrollRef.current = atBottom;
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!shouldAutoScrollRef.current) return;
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [reports]);

    return (
        <div className="flex flex-col h-full bg-[#0a0c12] text-xs font-mono">
            {reports.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-50 p-8 text-center">
                    <Scale size={48} className="mb-4" />
                    <p>No conscience reports generated yet.</p>
                    <p className="text-[10px] mt-2">Agent has not spoken or self-reflected.</p>
                </div>
            ) : (
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {reports.map((report, idx) => (
                        <div key={idx} className="bg-[#0f1219] border border-gray-800 rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Header */}
                            <div className="bg-[#151820] p-2 flex justify-between items-center border-b border-gray-800">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={12} className={report.self_assessment.overall_compliance_grade > 7 ? "text-green-400" : "text-yellow-400"} />
                                    <span className="text-gray-300 font-bold">CONFESSION REPORT</span>
                                    <span className="text-gray-600 text-[10px]">{new Date(report.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] text-gray-500 uppercase">HONESTY</span>
                                        <span className={`font-bold ${report.self_assessment.subjective_confidence > 0.8 ? "text-green-400" : "text-yellow-400"}`}>
                                            {(report.self_assessment.subjective_confidence * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="w-px h-6 bg-gray-700 mx-1"></div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] text-gray-500 uppercase">GRADE</span>
                                        <span className={`font-bold ${report.self_assessment.overall_compliance_grade >= 8 ? "text-blue-400" : "text-red-400"}`}>
                                            {report.self_assessment.overall_compliance_grade}/10
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Compliance Items */}
                            <div className="p-3 space-y-2">
                                {report.compliance_analysis.map((item, i) => (
                                    <div key={i} className="flex gap-2 items-start">
                                        <div className="mt-0.5">
                                            {item.compliance === 'fully_complied' && <CheckCircle size={10} className="text-green-500" />}
                                            {item.compliance === 'partially_complied' && <AlertTriangle size={10} className="text-yellow-500" />}
                                            {item.compliance === 'not_complied' && <AlertOctagon size={10} className="text-red-500" />}
                                            {item.compliance === 'unsure' && <HelpCircle size={10} className="text-gray-500" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-400 text-[10px] font-bold uppercase">{item.objective_id.replace(/_/g, ' ')}</span>
                                            </div>
                                            <p className="text-gray-500 text-[10px] italic">"{item.analysis}"</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Risk Flags */}
                            {report.risk_flags.length > 0 && !report.risk_flags.includes('none') && (
                                <div className="bg-red-900/10 border-t border-red-900/30 p-2">
                                    <div className="text-[9px] text-red-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <AlertTriangle size={8} /> Risk Flags Detected
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {report.risk_flags.map((flag, f) => (
                                            <span key={f} className="bg-red-900/30 text-red-300 px-2 py-0.5 rounded text-[9px] uppercase border border-red-900/50">
                                                {flag.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Known Issues */}
                            {report.self_assessment.known_issues.length > 0 && (
                                <div className="bg-yellow-900/10 border-t border-yellow-900/30 p-2">
                                    <div className="text-[9px] text-yellow-500 font-bold uppercase tracking-wider mb-1">Self-Reported Issues</div>
                                    <ul className="list-disc list-inside text-[9px] text-yellow-300/80">
                                        {report.self_assessment.known_issues.map((issue, k) => (
                                            <li key={k}>{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            )}
        </div>
    );
};
