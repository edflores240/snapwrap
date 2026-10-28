'use client';

import { useState } from 'react';
import { useAdmin } from '../layout';
import { supabase } from '@/lib/supabase';
import { PLANS, PlanName, getPlanLabel } from '@/lib/plans';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Playfair_Display } from 'next/font/google';
import {
    Check,
    CreditCard,
    Loader2,
    Sparkles,
    Calendar,
    Download,
    Lock,
    AlertCircle,
} from 'lucide-react';

const playfair = Playfair_Display({ subsets: ['latin'] });

interface Invoice {
    id: string;
    date: string;
    description: string;
    amount: string;
    status: 'paid' | 'pending';
}

export default function BillingPage() {
    const { profile, refreshProfile } = useAdmin();
    const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[number] | null>(null);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState<'card' | 'success'>('card');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [cardError, setCardError] = useState<string | null>(null);

    // Mock billing invoice data based on subscription status
    const mockInvoices: Invoice[] = [
        {
            id: 'INV-001',
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            description: `SnapWrap ${getPlanLabel(profile?.subscription_status ?? 'free')} Plan - Monthly Subscription`,
            amount: profile?.subscription_status === 'pro' ? '$29.00' : profile?.subscription_status === 'business' ? '$79.00' : '$0.00',
            status: 'paid',
        },
        {
            id: 'INV-002',
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            description: 'SnapWrap Free Trial Activation',
            amount: '$0.00',
            status: 'paid',
        }
    ];

    if (!profile) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#2A2724]" />
            </div>
        );
    }

    const currentPlan = profile.subscription_status || 'free';

    // Usage counts
    const eventLimit = currentPlan === 'free' ? 2 : Infinity;
    const aiLimit = currentPlan === 'free' ? 0 : currentPlan === 'pro' ? 20 : Infinity;

    const eventPercent = eventLimit === Infinity ? 100 : Math.min(100, (profile.events_created_this_month / eventLimit) * 100);
    const aiPercent = aiLimit === Infinity ? 100 : aiLimit === 0 ? 0 : Math.min(100, (profile.ai_credits_used_this_month / aiLimit) * 100);

    const handlePlanSelect = (plan: typeof PLANS[number]) => {
        if (plan.id === currentPlan) return;
        setSelectedPlan(plan);
        setCheckoutStep('card');
        setCardError(null);
    };

    const handleConfirmUpgrade = async () => {
        if (!selectedPlan) return;
        setIsCheckingOut(true);
        setCardError(null);

        // Simulate network latency for payment gateway
        await new Promise((resolve) => setTimeout(resolve, 1500));

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    subscription_status: selectedPlan.id,
                    // Reset limits when upgrading to a paid plan for testing convenience
                    events_created_this_month: 0,
                    ai_credits_used_this_month: 0,
                })
                .eq('id', profile.id);

            if (error) throw error;

            await refreshProfile();
            setSuccessMessage(`Successfully switched to the ${selectedPlan.name} plan!`);
            setCheckoutStep('success');
        } catch (err: any) {
            console.error('Failed to update subscription:', err);
            setCardError(err.message || 'An error occurred during checkout. Please try again.');
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="space-y-10">
            {/* Header */}
            <div>
                <h1 className={`text-4xl font-normal text-[#2A2724] tracking-tight ${playfair.className}`}>
                    Billing & Subscription
                </h1>
                <p className="text-neutral-500 text-sm mt-2">
                    Manage your subscription plan, monitor usage metrics, and view transaction history.
                </p>
            </div>

            {/* Current Plan Overview & Usage Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-6 border-[#ECE8DF] bg-white flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Current Plan</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                currentPlan === 'free' ? 'bg-neutral-100 text-neutral-600' :
                                currentPlan === 'pro' ? 'bg-indigo-50 text-indigo-600' :
                                'bg-amber-50 text-amber-700'
                            }`}>
                                {getPlanLabel(currentPlan)}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-neutral-500">Pricing</p>
                            <p className={`text-3xl font-normal text-[#2A2724] mt-1 ${playfair.className}`}>
                                {currentPlan === 'free' ? '$0' : currentPlan === 'pro' ? '$29' : '$79'}
                                <span className="text-xs text-neutral-400 font-sans font-medium"> / month</span>
                            </p>
                        </div>
                    </div>
                    <div className="border-t border-[#ECE8DF] pt-4 mt-6">
                        <p className="text-xs text-neutral-400">
                            {currentPlan === 'free' 
                                ? 'Unlock advanced layouts, guest self-capture, and AI background credits by upgrading.'
                                : `Next renewal date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
                            }
                        </p>
                    </div>
                </Card>

                {/* Usage limit card: Events */}
                <Card className="p-6 border-[#ECE8DF] bg-white space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Monthly Event Usage</span>
                            <h3 className="text-lg font-bold text-[#2A2724] mt-1">
                                {profile.events_created_this_month}
                                <span className="text-neutral-400 font-normal text-sm">
                                    {eventLimit === Infinity ? ' created (Unlimited)' : ` / ${eventLimit} events`}
                                </span>
                            </h3>
                        </div>
                        <Calendar size={18} className="text-neutral-400" />
                    </div>

                    <div className="space-y-2 pt-2">
                        <div className="h-2 bg-[#FAF8F5] border border-[#ECE8DF] rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-[#2A2724] transition-all duration-500" 
                                style={{ width: `${eventPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                            <span>{profile.events_created_this_month} events</span>
                            <span>{eventLimit === Infinity ? 'Unlimited' : `${eventLimit} limit`}</span>
                        </div>
                    </div>
                </Card>

                {/* Usage limit card: AI Credits */}
                <Card className="p-6 border-[#ECE8DF] bg-white space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">AI Background Credits</span>
                            <h3 className="text-lg font-bold text-[#2A2724] mt-1">
                                {currentPlan === 'free' ? '0' : profile.ai_credits_used_this_month}
                                <span className="text-neutral-400 font-normal text-sm">
                                    {aiLimit === Infinity ? ' used (Unlimited)' : aiLimit === 0 ? ' (Upgrade Required)' : ` / ${aiLimit} credits`}
                                </span>
                            </h3>
                        </div>
                        <Sparkles size={18} className="text-indigo-400" />
                    </div>

                    <div className="space-y-2 pt-2">
                        <div className="h-2 bg-[#FAF8F5] border border-[#ECE8DF] rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-500 transition-all duration-500" 
                                style={{ width: `${aiPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                            <span>{currentPlan === 'free' ? 0 : profile.ai_credits_used_this_month} used</span>
                            <span>{aiLimit === Infinity ? 'Unlimited' : `${aiLimit} credits`}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Plan Comparison Grid */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">Available Plans</h2>
                    <p className="text-xs text-neutral-500 mt-1">Choose the plan that matches your event operational scale.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {PLANS.map((plan) => {
                        const isCurrent = plan.id === currentPlan;
                        return (
                            <Card 
                                key={plan.id} 
                                className={`p-6 bg-white border flex flex-col justify-between transition-all ${
                                    isCurrent 
                                        ? 'border-[#2A2724] shadow-sm' 
                                        : 'border-[#ECE8DF] hover:border-neutral-400'
                                }`}
                            >
                                <div className="space-y-6">
                                    <div>
                                        <h3 className={`text-xl font-normal text-[#2A2724] ${playfair.className}`}>
                                            {plan.name}
                                        </h3>
                                        <p className="text-neutral-400 text-xs mt-1">{plan.description}</p>
                                    </div>

                                    <div>
                                        <p className={`text-4xl font-normal text-[#2A2724] ${playfair.className}`}>
                                            {plan.price}
                                            <span className="text-xs text-neutral-400 font-sans font-medium"> / month</span>
                                        </p>
                                    </div>

                                    <ul className="space-y-3">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2.5 text-xs text-neutral-600">
                                                <Check size={14} className="text-[#2A2724] mt-0.5 flex-shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="pt-8">
                                    <Button
                                        onClick={() => handlePlanSelect(plan)}
                                        disabled={isCurrent}
                                        className={`w-full text-xs font-bold py-2.5 rounded-lg border transition-all ${
                                            isCurrent 
                                                ? 'bg-[#FAF8F5] text-neutral-400 border-[#ECE8DF] cursor-default hover:bg-[#FAF8F5]'
                                                : 'bg-[#2A2724] text-white hover:bg-[#3D3935] border-transparent'
                                        }`}
                                    >
                                        {isCurrent ? 'Active Plan' : plan.priceMonthly > (PLANS.find(p => p.id === currentPlan)?.priceMonthly ?? 0) ? 'Upgrade' : 'Downgrade'}
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Invoices Table */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">Billing History</h2>
                    <p className="text-xs text-neutral-500 mt-1">Receipts and billing information for active operators.</p>
                </div>

                <Card className="border-[#ECE8DF] bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[#ECE8DF] bg-[#FAF8F5] text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                    <th className="p-4">Invoice ID</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Description</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Receipt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ECE8DF] text-xs">
                                {mockInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-[#FAF8F5]/50 transition-colors">
                                        <td className="p-4 font-mono font-medium text-neutral-600">{inv.id}</td>
                                        <td className="p-4 text-neutral-500">{inv.date}</td>
                                        <td className="p-4 font-semibold text-neutral-700">{inv.description}</td>
                                        <td className="p-4 text-[#2A2724] font-bold">{inv.amount}</td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-100">
                                                Paid
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => alert('Demo Receipt Downloaded!')} 
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ECE8DF] hover:bg-neutral-50 transition-all font-bold text-neutral-500"
                                            >
                                                <Download size={12} />
                                                Download
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* Checkout Dialog Modal */}
            {selectedPlan && (
                <div className="fixed inset-0 bg-[#2A2724]/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="bg-white border-[#ECE8DF] shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
                        {checkoutStep === 'card' ? (
                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className={`text-2xl font-normal text-[#2A2724] ${playfair.className}`}>
                                            Upgrade Subscription
                                        </h3>
                                        <p className="text-xs text-neutral-400 mt-1">Simulated Stripe Checkout</p>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedPlan(null)} 
                                        className="p-1 rounded-lg hover:bg-neutral-100 transition-all text-neutral-400"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#ECE8DF] flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-bold text-neutral-700">SnapWrap {selectedPlan.name}</p>
                                        <p className="text-[10px] text-neutral-400">Monthly subscription renewal</p>
                                    </div>
                                    <p className={`text-xl font-normal text-[#2A2724] ${playfair.className}`}>
                                        {selectedPlan.price}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Card Number</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                defaultValue="4242 •••• •••• 4242" 
                                                disabled 
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-[#ECE8DF] bg-[#FAF8F5] text-neutral-500 text-xs font-medium pl-10" 
                                            />
                                            <CreditCard size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Expiry Date</label>
                                            <input 
                                                type="text" 
                                                defaultValue="12 / 29" 
                                                disabled 
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-[#ECE8DF] bg-[#FAF8F5] text-neutral-500 text-xs font-medium" 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">CVC</label>
                                            <input 
                                                type="text" 
                                                defaultValue="***" 
                                                disabled 
                                                className="w-full px-3.5 py-2.5 rounded-lg border border-[#ECE8DF] bg-[#FAF8F5] text-neutral-500 text-xs font-medium" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                {cardError && (
                                    <div className="flex gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                        <span>{cardError}</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-2 text-[10px] text-neutral-400">
                                    <Lock size={12} className="text-green-500" />
                                    <span>Simulating Stripe payment processing sandbox. No real charges are made.</span>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-[#ECE8DF]">
                                    <Button
                                        onClick={() => setSelectedPlan(null)}
                                        disabled={isCheckingOut}
                                        className="flex-1 py-2.5 border border-[#ECE8DF] text-neutral-500 text-xs font-bold rounded-lg hover:bg-neutral-50 transition-all"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleConfirmUpgrade}
                                        disabled={isCheckingOut}
                                        className="flex-1 py-2.5 bg-[#2A2724] text-white hover:bg-[#3D3935] text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        {isCheckingOut ? (
                                            <>
                                                <Loader2 size={12} className="animate-spin" />
                                                Processing
                                            </>
                                        ) : (
                                            'Pay & Activate'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center space-y-6">
                                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-100">
                                    <Check size={24} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className={`text-2xl font-normal text-[#2A2724] ${playfair.className}`}>
                                        Subscription Activated
                                    </h3>
                                    <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                                        {successMessage} Your features, limits, and dashboard elements have been updated.
                                    </p>
                                </div>
                                <div className="pt-4">
                                    <Button
                                        onClick={() => setSelectedPlan(null)}
                                        className="w-full py-2.5 bg-[#2A2724] text-white hover:bg-[#3D3935] text-xs font-bold rounded-lg transition-all"
                                    >
                                        Back to Billing
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}
