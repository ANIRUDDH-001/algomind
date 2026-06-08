/**
 * @codesage
 */
// @ts-nocheck

// 

//  -- automated unused local suppression
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { UserProgress, CognitiveSkill } from '@/types/assessment';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { COLORS } from '@/lib/design-tokens';
import { format } from 'date-fns';

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
        paddingBottom: 60,
    },
    // Cover banner
    headerBanner: {
        backgroundColor: '#0f172a',
        padding: '32px 40px',
        marginBottom: 0,
    },
    headerBrand: {
        fontSize: 10,
        color: '#6366f1',
        fontFamily: 'Helvetica-Bold',
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    headerName: {
        fontSize: 28,
        color: '#ffffff',
        fontFamily: 'Helvetica-Bold',
    },
    headerDate: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 4,
    },

    // Score hero (below banner, full width)
    scoreHero: {
        backgroundColor: '#f8fafc',
        padding: '24px 40px',
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        marginBottom: 24,
    },
    scoreCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 24,
    },
    scoreNumber: {
        fontSize: 32,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
    },
    scoreSub: {
        fontSize: 9,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    // Stats row (4 numbers)
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 40,
        marginBottom: 32,
        gap: 0,
    },
    statBox: {
        flex: 1,
        paddingRight: 16,
        borderRightWidth: 1,
        borderRightColor: '#e2e8f0',
        marginRight: 16,
    },
    statValue: {
        fontSize: 20,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
    },
    statLabel: {
        fontSize: 9,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 2,
    },

    // Body content sections
    contentContainer: {
        paddingHorizontal: 40,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a',
        marginBottom: 16,
    },
    skillRow: {
        marginBottom: 16,
        paddingLeft: 12,
        borderLeftWidth: 3,
    },
    skillHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4
    },
    skillTitle: {
        flex: 1,
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: '#0f172a'
    },
    skillScoreLabel: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold'
    },
    skillTotalLabel: {
        fontSize: 9,
        color: '#94a3b8',
        marginLeft: 2
    },
    scoreBarContainer: {
        height: 4,
        backgroundColor: '#f1f5f9',
        borderRadius: 2,
        marginBottom: 6
    },
    skillEvidence: {
        fontSize: 9,
        color: '#475569',
        lineHeight: 1.4
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 24,
        left: 40,
        right: 40,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerText: {
        fontSize: 8,
        color: '#94a3b8'
    }
});

function getScoreColor(score: number): string {
    if (score >= 7.5) return '#10b981'; // emerald
    if (score >= 5) return '#6366f1'; // indigo
    return '#f59e0b';                   // amber
}

// Ensure safe type for colors
const getSkillColor = (skillId: string) => {
    return COLORS.skills[skillId as keyof typeof COLORS.skills] || '#6366f1';
};

const ReportFooter = () => (
    <View fixed style={styles.footer}>
        <Text style={styles.footerText}>
            AlgoMind AI Assessment • Confidential
        </Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
        } />
    </View>
);

interface PDFReportProps {
    progress: UserProgress;
    isIncompleteSession?: boolean;
}

function getScoreConditionalCopy(score: number): string {
    if (score >= 8) return 'This session reflected strong technical depth and clear communication.';
    if (score >= 6) return 'This session demonstrated solid technical thinking with some areas to refine.';
    if (score >= 3) return 'This session showed emerging problem-solving ability with clear areas to develop.';
    return 'This session showed significant room for growth. Focused practice on fundamentals is recommended.';
}

export const PDFReport = ({ progress, isIncompleteSession }: PDFReportProps) => {
    const candidateName = progress.userId; // Using userId as name fallback
    const date = format(new Date(), 'PPP');

    return (
        <Document>
            {/* Page 1: Cover + Summary */}
            <Page size="A4" style={styles.page}>
                <View style={styles.headerBanner}>
                    <Text style={styles.headerBrand}>AlgoMind Assessment Report</Text>
                    <Text style={styles.headerName}>{candidateName}</Text>
                    <Text style={styles.headerDate}>{date}</Text>
                </View>

                <View style={styles.scoreHero}>
                    <View style={[styles.scoreCircle, { borderColor: getScoreColor(progress.averageScore) }]}>
                        <Text style={styles.scoreNumber}>{progress.averageScore.toFixed(1)}</Text>
                    </View>
                    <View>
                        <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 2 }}>
                            Overall Cognitive Score
                        </Text>
                        <Text style={styles.scoreSub}>
                            Weighted aggregate of {Object.keys(progress.averageScores).length} skill dimensions
                        </Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{progress.totalSessions}</Text>
                        <Text style={styles.statLabel}>Total Sessions</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>
                            {progress.sessions.length > 0
                                ? format(new Date(progress.sessions[progress.sessions.length - 1].timestamp), 'MMM d, yyyy')
                                : 'N/A'}
                        </Text>
                        <Text style={styles.statLabel}>Latest Session</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{Object.keys(progress.averageScores).length}</Text>
                        <Text style={styles.statLabel}>Skills Assessed</Text>
                    </View>
                    <View style={[styles.statBox, { borderRightWidth: 0 }]}>
                        <Text style={styles.statValue}>
                            {progress.trends && progress.trends.filter(t => t.trend === 'improving').length > 0
                                ? progress.trends.filter(t => t.trend === 'improving').length
                                : progress.totalSessions <= 1 ? '—' : '0'}
                        </Text>
                        <Text style={styles.statLabel}>Improving Areas</Text>
                    </View>
                </View>

                <View style={styles.contentContainer}>
                    <Text style={styles.sectionTitle}>Performance Analysis</Text>
                    <Text style={{ fontSize: 10, color: '#475569', lineHeight: 1.5, marginBottom: 10 }}>
                        This report represents a comprehensive evaluation of cognitive performance across standard DSA domains.
                        {' '}{getScoreConditionalCopy(progress.averageScore)}
                    </Text>
                </View>

                <ReportFooter />
            </Page>

            {/* Page 2: Skill Breakdown */}
            <Page size="A4" style={styles.page}>
                <View style={[styles.contentContainer, { paddingTop: 40 }]}>
                    <Text style={styles.sectionTitle}>Cognitive Skill Breakdown</Text>

                    {Object.entries(progress.averageScores).map(([skillId, score]) => {
                        const color = getSkillColor(skillId);
                        const pct = (score / 10) * 100;
                        const definition = SKILL_DEFINITIONS[skillId as CognitiveSkill];

                        return (
                            <View key={skillId} style={[styles.skillRow, { borderLeftColor: color }]}>
                                <View style={styles.skillHeader}>
                                    <Text style={styles.skillTitle}>
                                        {definition?.name || skillId}
                                    </Text>
                                    <Text style={[styles.skillScoreLabel, { color }]}>
                                        {score.toFixed(1)}
                                    </Text>
                                    <Text style={styles.skillTotalLabel}>/10</Text>
                                </View>

                                <View style={styles.scoreBarContainer}>
                                    <View style={{
                                        height: 4,
                                        width: `${pct}%`,
                                        backgroundColor: color,
                                        borderRadius: 2,
                                    }} />
                                </View>

                                <Text style={styles.skillEvidence}>
                                    {definition?.description || "Skill performance rating"}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                <ReportFooter />
            </Page>

            {/* Page 3: Overall Feedback + Next Steps */}
            <Page size="A4" style={styles.page}>
                <View style={[styles.contentContainer, { paddingTop: 40 }]}>
                    {/* Incomplete session disclaimer */}
                    {isIncompleteSession && (
                        <View style={{
                            backgroundColor: '#fef3c7',
                            padding: 12,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: '#f59e0b',
                            marginBottom: 20,
                        }}>
                            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#92400e', marginBottom: 4 }}>
                                ⚠ Incomplete Session
                            </Text>
                            <Text style={{ fontSize: 9, color: '#92400e', lineHeight: 1.4 }}>
                                Note: This report is based on an incomplete session. Scores may not reflect true ability.
                            </Text>
                        </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 24 }}>
                        <View style={{ flex: 2 }}>
                            <Text style={styles.sectionTitle}>Overall Feedback</Text>
                            <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.6 }}>
                                {progress.narrative ||
                                    "The candidate demonstrates strong potential with their cognitive baseline. They should continue refining specific areas identified in the skill breakdown. Focusing on iterative problem solving and systematic approaches will yield further improvement."}
                            </Text>
                        </View>

                        <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 16, borderRadius: 8 }}>
                            <Text style={{
                                fontSize: 9,
                                fontFamily: 'Helvetica-Bold',
                                color: '#6366f1',
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                                marginBottom: 12
                            }}>
                                Next Steps
                            </Text>
                            {(progress.next_steps || [
                                'Review algorithm foundations for weak areas',
                                'Practice timed sessions with hard constraints',
                                'Focus on space/time complexity tradeoffs'
                            ]).slice(0, 5).map((step: string, i: number) => (
                                <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
                                    <Text style={{ fontSize: 9, color: '#6366f1', marginRight: 6, fontFamily: 'Helvetica-Bold' }}>
                                        {i + 1}.
                                    </Text>
                                    <Text style={{ fontSize: 9, color: '#334155', flex: 1, lineHeight: 1.5 }}>
                                        {step}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                <ReportFooter />
            </Page>
        </Document>
    );
};
