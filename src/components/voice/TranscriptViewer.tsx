import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface TranscriptViewerProps {
    transcript: string;
    interimTranscript: string;
    onEdit?: (newTranscript: string) => void;
    isEditable?: boolean;
}

export function TranscriptViewer({
    transcript,
    interimTranscript,
    onEdit,
    isEditable = true
}: TranscriptViewerProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editedText, setEditedText] = React.useState(transcript);

    // Auto-scroll to bottom when text changes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript, interimTranscript]);

    useEffect(() => {
        setEditedText(transcript);
    }, [transcript]);

    const handleSave = () => {
        if (onEdit) {
            onEdit(editedText);
        }
        setIsEditing(false);
    };

    return (
        <Card className="w-full h-full border-none bg-transparent shadow-none">
            <CardContent className="p-3 h-full flex flex-col relative group">
                {!isEditing && isEditable && transcript.length > 0 && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={() => setIsEditing(true)}
                    >
                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                )}

                {isEditing ? (
                    <div className="flex flex-col h-full gap-2">
                        <Textarea
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="flex-1 resize-none p-2 text-xs font-medium bg-slate-900/50 border-slate-800"
                            placeholder="Edit your transcript..."
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="xs" className="h-6 text-[10px]" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button size="xs" className="h-6 text-[10px]" onClick={handleSave}>Save</Button>
                        </div>
                    </div>
                ) : (
                    <div
                        ref={scrollRef}
                        className="h-full overflow-y-auto pr-2 space-y-1 font-medium text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800"
                    >
                        {transcript ? (
                            <span className="text-slate-200">{transcript}</span>
                        ) : (
                            <span className="text-slate-500 italic">Start speaking to see transcript...</span>
                        )}

                        {interimTranscript && (
                            <span className="text-slate-500 italic ml-1">{interimTranscript}</span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
