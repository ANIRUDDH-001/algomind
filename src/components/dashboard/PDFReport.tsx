/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { UserProgress, CognitiveSkill } from '@/types/assessment';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { format } from 'date-fns';

// Register a font if needed, or use defaults
// Font.register({ family: 'Inter', src: '...' });

const styles = StyleSheet.create({
    page: {
        padding: 40,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#2563eb',
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    section: {
        marginTop: 20,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    statGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    statBox: {
        width: '50%',
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statLabel: {
        fontSize: 10,
        color: '#64748b',
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2563eb',
    },
    skillRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    skillName: {
        fontSize: 12,
        color: '#334155',
    },
    skillScore: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 10,
        color: '#94a3b8',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
    }
});

interface PDFReportProps {
    progress: UserProgress;
}

export const PDFReport = ({ progress }: PDFReportProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>AlgoMind Cognitive Report</Text>
                <Text style={styles.subtitle}>Generated on {format(new Date(), 'PPP p')}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance Overview</Text>
                <View style={styles.statGrid}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Total Practice Sessions</Text>
                        <Text style={styles.statValue}>{progress.totalSessions}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Overall Cognitive Score</Text>
                        <Text style={styles.statValue}>{progress.averageScore.toFixed(1)}/10</Text>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance Analysis</Text>
                <Text style={{ fontSize: 10, color: '#475569', lineHeight: 1.5, marginBottom: 10 }}>
                    This report represents a comprehensive evaluation of cognitive performance across standard DSA domains.
                    The global score {progress.averageScore.toFixed(1)} reflects consistent agility and problem-solving depth.
                </Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cognitive Skill Profile</Text>
                {Object.entries(progress.averageScores).map(([skillId, score]) => (
                    <View key={skillId} style={styles.skillRow}>
                        <Text style={styles.skillName}>{SKILL_DEFINITIONS[skillId as CognitiveSkill]?.name || skillId}</Text>
                        <Text style={styles.skillScore}>{score.toFixed(1)}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Latest Sessions</Text>
                {progress.sessions.slice(0, 5).map((session, i) => (
                    <View key={session.sessionId} style={styles.skillRow}>
                        <Text style={styles.skillName}>{session.problemId} ({format(new Date(session.timestamp), 'MMM d')})</Text>
                        <Text style={styles.skillScore}>Score: {session.overallScore.toFixed(1)}</Text>
                    </View>
                ))}
            </View>

            <Text style={styles.footer}>
                © 2026 AlgoMind AI - Scientific DSA Assessment
            </Text>
        </Page>
    </Document>
);
