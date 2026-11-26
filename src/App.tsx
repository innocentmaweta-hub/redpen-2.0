import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import {
  Activity, Archive, ArrowLeft, Award, BarChart3, BookOpen, Bot, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3, FilePlus2, FileText,
  FolderOpen, GraduationCap, Layers, LayoutDashboard, LogOut, Menu, MessageSquare, MoreHorizontal, Eye,
  PanelLeftClose, Plus, Printer, Save, Search, Settings, ShieldCheck, Sparkles, Trash2,
  Upload, Users, X, Zap
} from 'lucide-react';
import logo from './assets/logo.png';
import { extractDocument } from './lib/documentReader';
import { exportResultsExcel, exportResultsPdf } from './lib/reportExports';
import ManualPaperCanvas from './components/ManualPaperCanvas';
import './features.css';

type Screen = 'dashboard' | 'grade' | 'results' | 'history' | 'batch' | 'institutions' | 'settings';
type Question = { id: string; label: string; max: number; score: number; feedback: string };
type Course = { id: string; code: string; name: string; year: string; term: string; schemeName?: string };
type Workbook = { id: string; name: string; institution: string; createdAt: string; courses: Course[] };
type Student = { name: string; id: string; className: string };
type Result = { id: string; assessmentId?: string; schemePath?: string; paperPath?: string; paperAnnotations?: Record<string, string>; courseId?: string; workbookId?: string; institutionName?: string; student: Student; courseName: string; workbookName: string; date: string; questions: Question[]; total: number; maximum: number; percentage: number; grade: string; feedback: string; paperName: string; };
type BatchFile = { id: string; name: string; size: number; status: 'Ready' | 'Processing' | 'Completed' | 'Needs review' | 'Failed'; storagePath?: string; batchJobId?: string };
type BatchPreview = { name: string; url: string; mimeType: string };
const STORE = 'redpen-2.0-workspace-v1';
const uid = () => crypto.randomUUID();
const starter: Workbook[] = [];
const grades = [{ min: 80, grade: 'A+' }, { min: 75, grade: 'A' }, { min: 70, grade: 'B+' }, { min: 65, grade: 'B' }, { min: 60, grade: 'C+' }, { min: 55, grade: 'C' }, { min: 50, grade: 'D' }, { min: 0, grade: 'F' }];
function gradeFor(p: number) { return grades.find(g => p >= g.min)?.grade ?? 'F'; }
function readStore(): { workbooks: Workbook[]; results: Result[] } {
  try { const value = JSON.parse(localStorage.getItem(STORE) || 'null'); if (value && Array.isArray(value.workbooks) && Array.isArray(value.results)) return value; } catch {}
  return { workbooks: starter, results: [] };
}
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
function App({ user }: { user: User }) {
  const initial = readStore();
  const skipNextCloudSave = useRef(false);
  const [workbooks, setWorkbooks] = useState<Workbook[]>(initial.workbooks);
  const [results, setResults] = useState<Result[]>(initial.results);
  const [activeWorkbookId, setActiveWorkbookId] = useState(initial.workbooks[0]?.id || '');
  const [activeCourseId, setActiveCourseId] = useState(initial.workbooks[0]?.courses[0]?.id || '');
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [student, setStudent] = useState<Student>({ name: '', id: '', className: '' });
  const [scheme, setScheme] = useState<File | null>(null);
  const [noScheme, setNoScheme] = useState(false);
  const [paper, setPaper] = useState<File | null>(null);
  const [paperUrl, setPaperUrl] = useState('');
  const [paperAnnotations, setPaperAnnotations] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<Question[]>([{ id: uid(), label: 'Question 1', max: 10, score: 0, feedback: '' }]);
  const [overallFeedback, setOverallFeedback] = useState('');
  const [search, setSearch] = useState('');
  const [resultCourseFilter, setResultCourseFilter] = useState('');
  const [resultInstitutionFilter, setResultInstitutionFilter] = useState('');
  const [resultWorkbookFilter, setResultWorkbookFilter] = useState('');
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [yazaOpen, setYazaOpen] = useState(false);
  const [yazaInput, setYazaInput] = useState('');
  const [yazaMessages, setYazaMessages] = useState<{role:'assistant'|'user'; text:string}[]>([{ role:'assistant', text:'Hello! I am Yaza AI. I can help you navigate RedPen, prepare assessments, edit marks and feedback, and carry out actions you request.' }]);
  const [yazaBusy, setYazaBusy] = useState(false);
  const [modal, setModal] = useState<'workbook'|'course'|null>(null);
  const [workbookName, setWorkbookName] = useState('');
  const [institution, setInstitution] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiGradingMeta, setAiGradingMeta] = useState<{ provider: string; model: string; usage: unknown; needsReview: boolean; reviewNotes: string[] } | null>(null);
  const [batchScheme, setBatchScheme] = useState<File | null>(null);
  const [batchNoScheme, setBatchNoScheme] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchPreview, setBatchPreview] = useState<BatchPreview | null>(null);
  const [batchPreviewBusyId, setBatchPreviewBusyId] = useState<string | null>(null);
  const [batchReviewBusyId, setBatchReviewBusyId] = useState<string | null>(null);
  const [reviewContext, setReviewContext] = useState<{ assessmentId: string; studentId: string; schemePath?: string; paperPath?: string } | null>(null);
  const [institutions, setInstitutions] = useState<{ id: string; name: string; owner_id: string }[]>([]);
  const [activeInstitutionId, setActiveInstitutionId] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [institutionBusy, setInstitutionBusy] = useState(false);
  const [institutionName, setInstitutionName] = useState('');

  useEffect(() => {
    if (skipNextCloudSave.current) { skipNextCloudSave.current = false; return; }
    const snapshot = { workbooks, results, sync_token: uid() };
    localStorage.setItem(STORE, JSON.stringify(snapshot));
    const timer = window.setTimeout(async () => {
      const { error } = await supabase.from('workspace_snapshots').upsert(
        { user_id: user.id, data: snapshot, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      if (error) console.error('RedPen cloud save failed:', error.message);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [workbooks, results, user.id]);
  useEffect(() => () => { if (paperUrl) URL.revokeObjectURL(paperUrl); }, [paperUrl]);
  useEffect(() => {
    const receiveCloudWorkspace = (event: Event) => {
      const snapshot = (event as CustomEvent).detail;
      if (snapshot && Array.isArray(snapshot.workbooks) && Array.isArray(snapshot.results)) {
        skipNextCloudSave.current = true;
        setWorkbooks(snapshot.workbooks);
        setResults(snapshot.results);
      }
    };
    window.addEventListener('redpen-cloud-workspace', receiveCloudWorkspace);
    return () => window.removeEventListener('redpen-cloud-workspace', receiveCloudWorkspace);
  }, []);
  useEffect(() => {
    let alive = true;
    const loadPersistentRecords = async () => {
      const [workbookResponse, assessmentResponse] = await Promise.all([
        supabase.from('workbooks').select('id,name,institution_name,created_at,courses(id,code,name,academic_year,term)').order('created_at', { ascending: false }),
        supabase.from('assessments').select('id,assessed_at,paper_filename,marking_scheme_path,answer_paper_path,students(full_name,student_number,class_name),courses(name),workbooks(name,institution_name),grading_results(score,maximum_score,percentage,grade,feedback,question_scores,paper_annotations)').order('assessed_at', { ascending: false }).limit(1000),
      ]);
      if (!alive) return;
      if (workbookResponse.error) console.error('Could not load shared workbooks:', workbookResponse.error.message);
      else {
        const rows = workbookResponse.data || [];
        const mapped: Workbook[] = rows.map((row: any) => ({
          id: row.id, name: row.name, institution: row.institution_name || '',
          createdAt: row.created_at,
          courses: (row.courses || []).map((course: any) => ({
            id: course.id, code: course.code || '', name: course.name,
            year: course.academic_year || '', term: course.term || '',
          })),
        }));
        setWorkbooks(mapped);
        setActiveWorkbookId(current => mapped.some(w => w.id === current) ? current : (mapped[0]?.id || ''));
        setActiveCourseId(current => mapped.some(w => w.courses.some(c => c.id === current)) ? current : (mapped[0]?.courses[0]?.id || ''));
      }
      if (assessmentResponse.error) console.error('Could not load shared assessments:', assessmentResponse.error.message);
      else {
        const mappedResults: Result[] = (assessmentResponse.data || []).flatMap((row: any) => {
          const grade = Array.isArray(row.grading_results) ? row.grading_results[0] : row.grading_results;
          if (!grade) return [];
          const studentRow = Array.isArray(row.students) ? row.students[0] : row.students;
          const courseRow = Array.isArray(row.courses) ? row.courses[0] : row.courses;
          const workbookRow = Array.isArray(row.workbooks) ? row.workbooks[0] : row.workbooks;
          const questionRows = Array.isArray(grade.question_scores) ? grade.question_scores : [];
          return [{
            id: row.id, assessmentId: row.id,
            schemePath: row.marking_scheme_path || undefined,
            paperPath: row.answer_paper_path || undefined,
            student: { name: studentRow?.full_name || 'Unknown student', id: studentRow?.student_number || '', className: studentRow?.class_name || '' },
            courseId: row.course_id || undefined, workbookId: row.workbook_id || undefined,
            institutionName: workbookRow?.institution_name || '',
            courseName: courseRow?.name || 'Course', workbookName: workbookRow?.name || '',
            date: row.assessed_at, questions: questionRows, paperAnnotations: grade.paper_annotations || {}, total: Number(grade.score || 0),
            maximum: Number(grade.maximum_score || 0), percentage: Number(grade.percentage || 0),
            grade: grade.grade || '—', feedback: grade.feedback || '', paperName: row.paper_filename || '',
          } as Result];
        });
        setResults(mappedResults);
      }
    };
    void loadPersistentRecords();
    return () => { alive = false; };
  }, [user.id]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    let alive = true;
    const loadInstitutions = async () => {
      const { data, error } = await supabase.from('institutions').select('id,name,owner_id').order('created_at', { ascending: false });
      if (!alive) return;
      if (error) { console.error('Could not load institutions:', error.message); return; }
      setInstitutions(data || []);
      setActiveInstitutionId(current => current || data?.[0]?.id || '');
    };
    void loadInstitutions();
    return () => { alive = false; };
  }, [user.id]);
  useEffect(() => {
    if (!activeInstitutionId) { setMembers([]); return; }
    let alive = true;
    void supabase.functions.invoke('institution-admin', { body: { action: 'list_members', institutionId: activeInstitutionId } })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || data?.error) { setMembers([]); return; }
        setMembers(data?.members || []);
      });
    return () => { alive = false; };
  }, [activeInstitutionId]);
  useEffect(() => {
    let alive = true;
    const loadLatestBatch = async () => {
      const { data, error } = await supabase.from('batch_jobs')
        .select('id, marking_scheme_path, batch_job_files(id,original_filename,file_size_bytes,status,storage_path)')
        .eq('owner_id', user.id).order('created_at', { ascending: false }).limit(20);
      if (!alive) return;
      if (error) { console.error('Could not load batch queue:', error.message); return; }
      setBatchFiles((data || []).flatMap(job => (job.batch_job_files || []).map(file => ({
        id: file.id, name: file.original_filename, size: Number(file.file_size_bytes || 0),
        status: file.status === 'completed' ? 'Completed' as const : file.status === 'processing' ? 'Processing' as const : file.status === 'failed' ? 'Failed' as const : file.status === 'needs_review' ? 'Needs review' as const : 'Ready' as const,
        storagePath: file.storage_path, batchJobId: job.id,
      }))));
    };
    void loadLatestBatch();
    return () => { alive = false; };
  }, [user.id]);
  const activeWorkbook = workbooks.find(w => w.id === activeWorkbookId) || null;
  const activeCourse = activeWorkbook?.courses.find(c => c.id === activeCourseId) || activeWorkbook?.courses[0] || null;
  const totalMarks = questions.reduce((sum, q) => sum + Math.max(0, Number(q.max) || 0), 0);
  const earnedMarks = questions.reduce((sum, q) => sum + Math.min(Math.max(0, Number(q.score) || 0), Math.max(0, Number(q.max) || 0)), 0);
  const percentage = totalMarks ? Math.round(earnedMarks / totalMarks * 1000) / 10 : 0;
  const resultCourses = useMemo(() => Array.from(new Map(results.map(r => [r.courseId || r.courseName, { id: r.courseId || r.courseName, name: r.courseName }])).values()).sort((a,b)=>a.name.localeCompare(b.name)), [results]);
  const resultInstitutions = useMemo(() => Array.from(new Set(results.map(r => r.institutionName || '').filter(Boolean))).sort((a,b)=>a.localeCompare(b)), [results]);
  const resultWorkbooks = useMemo(() => Array.from(new Map(results.map(r => [r.workbookId || r.workbookName, { id: r.workbookId || r.workbookName, name: r.workbookName }])).values()).sort((a,b)=>a.name.localeCompare(b.name)), [results]);
  const filteredResults = useMemo(() => results.filter(r =>
    (!resultCourseFilter || (r.courseId || r.courseName) === resultCourseFilter) &&
    (!resultInstitutionFilter || (r.institutionName || '') === resultInstitutionFilter) &&
    (!resultWorkbookFilter || (r.workbookId || r.workbookName) === resultWorkbookFilter) &&
    [r.student.name, r.student.id, r.courseName, r.institutionName, r.workbookName, r.grade].join(' ').toLowerCase().includes(search.toLowerCase())
  ), [results, search, resultCourseFilter, resultInstitutionFilter, resultWorkbookFilter]);
  const navigate = (next: Screen) => { setScreen(next); setMobileNav(false); };
  const startGrading = () => { setReviewContext(null); setStudent({ name: '', id: '', className: '' }); setScheme(null); setNoScheme(false); setPaper(null); setPaperUrl(''); setQuestions([{ id: uid(), label: 'Question 1', max: 10, score: 0, feedback: '' }]); setPaperAnnotations({}); setOverallFeedback(''); setMode('manual'); setAiGradingMeta(null); navigate('grade'); };
  const onPaper = (file?: File) => { if (!file) return; if (file.size > 25 * 1024 * 1024) { setToast('Please choose a file smaller than 25 MB.'); return; } setPaper(file); if (paperUrl) URL.revokeObjectURL(paperUrl); setPaperUrl(URL.createObjectURL(file)); };
  const runAiGrading = async (schemeFile = (noScheme ? null : scheme), paperFile = paper) => {
    if ((!schemeFile && !noScheme) || !paperFile) { setToast('Choose a marking scheme or select No marking scheme, then upload the student paper.'); return null; }
    if (!activeCourse) { setToast('Create or select a course before grading.'); return null; }
    setAiBusy(true);
    try {
      const [schemeDoc, paperDoc] = await Promise.all([schemeFile ? extractDocument(schemeFile) : Promise.resolve({ text: '', images: [], warnings: [] }), extractDocument(paperFile)]);
      const { data, error } = await supabase.functions.invoke('ai-grade', { body: { noScheme: !schemeFile, schemeText: schemeDoc.text, schemeImages: schemeDoc.images, paperText: paperDoc.text, paperImages: paperDoc.images, sourceWarnings: [...schemeDoc.warnings, ...paperDoc.warnings] } });
      if (error) {
        let detail = data?.error || '';
        const context = (error as any).context;
        if (!detail && context && typeof context.clone === 'function') {
          try {
            const responseBody = await context.clone().json();
            detail = responseBody?.error || responseBody?.message || '';
          } catch { /* Keep the SDK error when the response is not JSON. */ }
        }
        throw new Error(detail || (error.message + ' (AI grading service). Check Supabase Edge Function logs for the provider response.'));
      }
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.questions) || !data.questions.length) throw new Error('The AI did not return question-level marks.');
      const marks: Question[] = data.questions.map((q: any, i: number) => ({ id: q.id || uid(), label: String(q.label || ('Question ' + (i + 1))), max: Number(q.max), score: Number(q.score), feedback: String(q.feedback || '') }));
      if (marks.some(q => !Number.isFinite(q.max) || q.max <= 0 || !Number.isFinite(q.score) || q.score < 0 || q.score > q.max)) throw new Error('The AI returned marks outside the valid ranges. No marks were applied.');
      setStudent(current => ({ name: data.student?.name || current.name || paperFile.name.replace(/\\.[^.]+$/, ''), id: data.student?.id || current.id, className: data.student?.className || current.className }));
      setQuestions(marks);
      setOverallFeedback(String(data.overallFeedback || ''));
      setAiGradingMeta({ provider: data.provider || 'AI provider', model: data.model || 'configured model', usage: data.usage || null, needsReview: Boolean(data.needsReview) || !schemeFile, reviewNotes: [...(Array.isArray(data.reviewNotes) ? data.reviewNotes : []), ...(!schemeFile ? ['No official marking scheme was supplied; AI-generated criteria and maximum marks require teacher approval.'] : [])] });
      setMode('ai');
      setToast(data.needsReview ? 'AI draft completed. Review the flagged items carefully before saving.' : 'AI marking draft completed. Review every question before saving.');
      return data;
    } catch (cause) { setToast(cause instanceof Error ? cause.message : 'AI grading failed. Please try again.'); return null; }
    finally { setAiBusy(false); }
  };
  const saveResult = async () => {
    if (!student.name.trim()) { setToast('Enter the student name before saving.'); return; }
    if (!activeCourse) { setToast('Create or select a course first.'); return; }
    if (!questions.length || totalMarks <= 0) { setToast('Add at least one question with a maximum mark.'); return; }
    if (questions.some(q => q.score < 0 || q.score > q.max || q.max <= 0)) { setToast('Check the question scores: each score must be within its maximum.'); return; }
    if (reviewContext) {
      try {
        const { error: studentUpdateError } = await supabase.from('students').update({
          full_name: student.name.trim(), student_number: student.id.trim() || null,
          class_name: student.className.trim() || null,
        }).eq('id', reviewContext.studentId);
        if (studentUpdateError) throw studentUpdateError;
        const { error: marksUpdateError } = await supabase.from('grading_results').update({
          score: earnedMarks, maximum_score: totalMarks, percentage,
          grade: gradeFor(percentage), feedback: overallFeedback,
          question_scores: questions.map(q => ({ ...q })), paper_annotations: paperAnnotations,
        }).eq('assessment_id', reviewContext.assessmentId);
        if (marksUpdateError) throw marksUpdateError;
        const { error: assessmentUpdateError } = await supabase.from('assessments').update({ status: 'completed' }).eq('id', reviewContext.assessmentId);
        if (assessmentUpdateError) throw assessmentUpdateError;
        await supabase.from('ai_grading_runs').update({ status: 'completed' }).eq('assessment_id', reviewContext.assessmentId);
        const revised: Result = {
          id: reviewContext.assessmentId, assessmentId: reviewContext.assessmentId,
          courseId: activeCourse.id, workbookId: activeWorkbook?.id, institutionName: activeWorkbook?.institution || '',
          schemePath: reviewContext.schemePath, paperPath: reviewContext.paperPath,
          student: { ...student }, courseName: activeCourse.name, workbookName: activeWorkbook?.name || '',
          date: new Date().toISOString(), questions: questions.map(q => ({ ...q })),
          total: earnedMarks, maximum: totalMarks, percentage, grade: gradeFor(percentage),
          feedback: overallFeedback, paperName: paper?.name || '', paperAnnotations: { ...paperAnnotations },
        };
        setResults(current => current.map(item => item.assessmentId === reviewContext.assessmentId ? revised : item));
        setBatchFiles(current => current.map(item => item.storagePath === reviewContext.paperPath ? { ...item, status: 'Completed' } : item));
        setReviewContext(null);
        setToast('Review saved. The existing batch assessment has been updated and approved.');
        navigate('results');
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : 'Please try again.';
        setToast('Could not save review: ' + detail);
      }
      return;
    }
    const assessmentId = uid();
    const uploadedPaths: string[] = [];
    const uploadAssessmentFile = async (file: File | null, kind: 'scheme' | 'paper') => {
      if (!file) return null;
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'file';
      const path = `${user.id}/${assessmentId}/${kind}-${uid()}.${extension}`;
      const { error } = await supabase.storage.from('redpen-assessment-files').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (error) throw error;
      uploadedPaths.push(path);
      return path;
    };
    let saveStage = 'Preparing assessment files';
    try {
      saveStage = 'Uploading student paper / marking scheme';
      const schemePath = await uploadAssessmentFile(noScheme ? null : scheme, 'scheme');
      const paperPath = await uploadAssessmentFile(paper, 'paper');
      saveStage = 'Creating student record';
      const { data: studentRow, error: studentError } = await supabase.from('students').insert({
        owner_id: user.id, full_name: student.name.trim(),
        student_number: student.id.trim() || null, class_name: student.className.trim() || null,
      }).select('id').single();
      if (studentError) throw new Error(studentError.message || JSON.stringify(studentError));
      saveStage = 'Creating assessment record';
      const { error: assessmentError } = await supabase.from('assessments').insert({
        id: assessmentId, owner_id: user.id, workbook_id: activeWorkbook?.id || null,
        course_id: activeCourse.id, student_id: studentRow.id,
        marking_scheme_path: schemePath, answer_paper_path: paperPath,
        paper_filename: paper?.name || null, status: aiGradingMeta?.needsReview ? 'needs_review' : 'completed',
      });
      if (assessmentError) {
        await supabase.from('students').delete().eq('id', studentRow.id);
        throw new Error(assessmentError.message || JSON.stringify(assessmentError));
      }
      saveStage = 'Saving grading marks';
      const { error: resultError } = await supabase.from('grading_results').insert({
        owner_id: user.id, assessment_id: assessmentId, score: earnedMarks,
        maximum_score: totalMarks, percentage, grade: gradeFor(percentage),
        feedback: overallFeedback, question_scores: questions.map(q => ({ ...q })), paper_annotations: paperAnnotations,
      });
      if (resultError) {
        await supabase.from('assessments').delete().eq('id', assessmentId);
        await supabase.from('students').delete().eq('id', studentRow.id);
        throw new Error(resultError.message || JSON.stringify(resultError));
      }
      const result: Result = {
        id: assessmentId, assessmentId, courseId: activeCourse.id, workbookId: activeWorkbook?.id,
        institutionName: activeWorkbook?.institution || '', schemePath: schemePath || undefined, paperPath: paperPath || undefined,
        student: { ...student }, courseName: activeCourse.name, workbookName: activeWorkbook?.name || '',
        date: new Date().toISOString(), questions: questions.map(q => ({ ...q })), total: earnedMarks,
        maximum: totalMarks, percentage, grade: gradeFor(percentage), feedback: overallFeedback,
        paperName: paper?.name || '', paperAnnotations: { ...paperAnnotations },
      };
      if (aiGradingMeta) {
        const { error: aiLogError } = await supabase.from('ai_grading_runs').insert({
          owner_id: user.id, assessment_id: assessmentId, provider: aiGradingMeta.provider,
          model: aiGradingMeta.model, status: aiGradingMeta.needsReview ? 'needs_review' : 'completed',
          input_summary: { marking_scheme: Boolean(schemePath), answer_paper: Boolean(paperPath) },
          output_summary: { question_count: questions.length, percentage, review_required: aiGradingMeta.needsReview, review_notes: aiGradingMeta.reviewNotes },
        });
        if (aiLogError) console.warn('Could not write AI audit record:', aiLogError.message);
      }
      setResults(current => [result, ...current]);
      setToast('Grading result saved securely to your RedPen cloud workspace.');
      navigate('results');
    } catch (cause) {
      if (uploadedPaths.length) await supabase.storage.from('redpen-assessment-files').remove(uploadedPaths);
      const detail = cause instanceof Error ? cause.message : (cause && typeof cause === 'object' && 'message' in cause ? String((cause as any).message) : JSON.stringify(cause));
      console.error('RedPen assessment save failed:', { stage: saveStage, cause });
      setToast(`Could not save assessment during: ${saveStage}. ${detail || 'Unknown Supabase error.'}`);
    }
  };
  const addWorkbook = async () => {
    if (!workbookName.trim()) return;
    const selectedInstitution = institutions.find(item => item.id === activeInstitutionId);
    const { data, error } = await supabase.from('workbooks').insert({
      owner_id: user.id, name: workbookName.trim(), institution_id: activeInstitutionId || null,
      institution_name: selectedInstitution?.name || institution.trim() || null,
    }).select('id,created_at').single();
    if (error) { setToast(`Could not create workbook: ${error.message}`); return; }
    const w: Workbook = { id: data.id, name: workbookName.trim(), institution: selectedInstitution?.name || institution.trim(), createdAt: data.created_at, courses: [] };
    setWorkbooks(current => [...current, w]); setActiveWorkbookId(w.id); setActiveCourseId('');
    setWorkbookName(''); setInstitution(''); setModal(null); setToast('Workbook created in your cloud workspace.');
  };
  const addCourse = async () => {
    if (!activeWorkbook || !courseName.trim()) return;
    const year = String(new Date().getFullYear());
    const { data, error } = await supabase.from('courses').insert({
      owner_id: user.id, workbook_id: activeWorkbook.id, code: courseCode.trim(),
      name: courseName.trim(), academic_year: year, term: 'Semester 1',
    }).select('id').single();
    if (error) { setToast(`Could not add course: ${error.message}`); return; }
    const c: Course = { id: data.id, code: courseCode.trim(), name: courseName.trim(), year, term: 'Semester 1' };
    setWorkbooks(current => current.map(w => w.id === activeWorkbook.id ? { ...w, courses: [...w.courses, c] } : w));
    setActiveCourseId(c.id); setCourseCode(''); setCourseName(''); setModal(null); setToast('Course saved to your cloud workspace.');
  };
  const addQuestion = () => setQuestions(current => [...current, { id: uid(), label: `Question ${current.length + 1}`, max: 10, score: 0, feedback: '' }]);
  const updateQuestion = (id: string, patch: Partial<Question>) => setQuestions(current => current.map(q => q.id === id ? { ...q, ...patch } : q));
  const sendYaza = async () => {
    const value = yazaInput.trim();
    if (!value || yazaBusy) return;
    const history = [...yazaMessages, { role: 'user' as const, text: value }];
    setYazaMessages(history);
    setYazaInput('');
    setYazaBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('yaza-assistant', {
        body: {
          message: value,
          history: yazaMessages.slice(-10),
          appContext: {
            screen, mode, student, questions, overallFeedback,
            paperUploaded: Boolean(paper), markingSchemeUploaded: Boolean(scheme) || noScheme,
            noScheme, workbook: activeWorkbook?.name || null, course: activeCourse?.name || null,
            resultsCount: results.length,
          },
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Yaza could not respond.');
      const outcomes: string[] = [];
      for (const action of (Array.isArray(data?.actions) ? data.actions : [])) {
        const args = action.args || {};
        switch (action.name) {
          case 'navigate_screen':
            if (['dashboard','grade','results','history','batch','institutions','settings'].includes(args.screen)) { navigate(args.screen); outcomes.push('Opened ' + args.screen + '.'); }
            break;
          case 'update_student_fields':
            setStudent(current => ({ name: args.name ?? current.name, id: args.student_id ?? current.id, className: args.class_name ?? current.className }));
            outcomes.push('Updated the student information form.');
            break;
          case 'set_marking_mode':
            if (args.mode === 'manual' || args.mode === 'ai') { setMode(args.mode); outcomes.push('Switched to ' + args.mode + ' marking.'); }
            break;
          case 'add_question':
            if (typeof args.label === 'string' && Number(args.maximum_mark) > 0) {
              setQuestions(current => [...current, { id: uid(), label: args.label, max: Number(args.maximum_mark), score: 0, feedback: '' }]);
              outcomes.push('Added ' + args.label + '.');
            }
            break;
          case 'update_question': {
            const index = Number(args.question_number) - 1;
            const target = questions[index];
            if (target) {
              const patch: Partial<Question> = {};
              if (args.score !== undefined && Number.isFinite(Number(args.score))) patch.score = Number(args.score);
              if (typeof args.feedback === 'string') patch.feedback = args.feedback;
              if (patch.score === undefined || (patch.score >= 0 && patch.score <= target.max)) {
                updateQuestion(target.id, patch);
                outcomes.push('Updated ' + target.label + '.');
              } else outcomes.push('Skipped an invalid mark for ' + target.label + '.');
            }
            break;
          }
          case 'set_overall_feedback':
            if (typeof args.feedback === 'string') { setOverallFeedback(args.feedback); outcomes.push('Updated overall feedback.'); }
            break;
          case 'run_ai_marking':
            if (window.confirm('Yaza wants to run AI marking on the currently uploaded paper. Continue?')) {
              outcomes.push(await runAiGrading() ? 'AI marking completed. Review the draft before saving.' : 'AI marking did not complete.');
            } else outcomes.push('AI marking cancelled.');
            break;
          case 'save_assessment':
            if (window.confirm('Yaza wants to save this grading result to your RedPen records. Continue?')) { await saveResult(); outcomes.push('Save was requested. Check the app notification for the result.'); }
            else outcomes.push('Saving cancelled.');
            break;
        }
      }
      const reply = String(data?.reply || 'I have processed your request.');
      setYazaMessages(current => [...current, { role: 'assistant', text: reply + (outcomes.length ? '\n\n' + outcomes.join(' ') : '') }]);
    } catch (cause) {
      setYazaMessages(current => [...current, { role: 'assistant', text: cause instanceof Error ? cause.message : 'Yaza could not respond. Please try again.' }]);
    } finally { setYazaBusy(false); }
  };
  const addBatch = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!batchScheme && !batchNoScheme) { setToast('Upload a marking scheme or select No marking scheme before adding papers.'); return; }
    const selected = Array.from(files);
    const jobId = uid();
    let schemePath: string | null = null;
    if (!batchNoScheme && batchScheme) {
      const schemeExtension = batchScheme.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
      schemePath = user.id + '/batch/' + jobId + '/scheme-' + uid() + '.' + schemeExtension;
      const { error: schemeUploadError } = await supabase.storage.from('redpen-assessment-files').upload(schemePath, batchScheme, { contentType: batchScheme.type || 'application/octet-stream' });
      if (schemeUploadError) { setToast('Could not upload batch marking scheme: ' + schemeUploadError.message); return; }
    }
    const { data: job, error: jobError } = await supabase.from('batch_jobs').insert({
      id: jobId, owner_id: user.id, workbook_id: activeWorkbook?.id || null,
      course_id: activeCourse?.id || null, marking_scheme_path: schemePath,
      status: 'queued', total_files: selected.length,
    }).select('id').single();
    if (jobError) { if (schemePath) await supabase.storage.from('redpen-assessment-files').remove([schemePath]); setToast('Could not create batch: ' + jobError.message); return; }
    const uploaded: BatchFile[] = [];
    for (const file of selected) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = user.id + '/batch/' + job.id + '/' + uid() + '-' + safeName;
      const { error: uploadError } = await supabase.storage.from('redpen-assessment-files').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) { console.error('Batch file upload failed:', uploadError.message); continue; }
      const { data: fileRow, error: rowError } = await supabase.from('batch_job_files').insert({
        owner_id: user.id, batch_job_id: job.id, storage_path: path,
        original_filename: file.name, file_size_bytes: file.size, status: 'queued',
      }).select('id').single();
      if (rowError) {
        await supabase.storage.from('redpen-assessment-files').remove([path]);
        console.error('Batch file record failed:', rowError.message);
        continue;
      }
      uploaded.push({ id: fileRow.id, name: file.name, size: file.size, status: 'Ready', storagePath: path, batchJobId: job.id });
    }
    if (uploaded.length) {
      await supabase.from('batch_jobs').update({ total_files: uploaded.length }).eq('id', job.id);
      setBatchFiles(current => [...current, ...uploaded]);
      setToast(uploaded.length + ' paper(s) uploaded securely. Select Process batch to start AI marking.');
    } else {
      await supabase.from('batch_jobs').delete().eq('id', job.id);
      await supabase.storage.from('redpen-assessment-files').remove([schemePath]);
      setToast('No papers could be uploaded. Check the file type and try again.');
    }
  };
  const openSavedDocumentPreview = async (path: string | undefined, name: string, label: string) => {
    if (!path) { setToast('No saved ' + label.toLowerCase() + ' is attached to this assessment.'); return; }
    const previewId = 'saved-' + path;
    setBatchPreviewBusyId(previewId);
    try {
      const { data, error } = await supabase.storage.from('redpen-assessment-files').download(path);
      if (error || !data) throw error || new Error('Could not download the saved document.');
      const extension = name.split('.').pop()?.toLowerCase() || '';
      const mimeType = data.type && data.type !== 'application/octet-stream' ? data.type : (extension === 'pdf' ? 'application/pdf' : extension === 'txt' ? 'text/plain' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'gif' ? 'image/gif' : 'image/jpeg');
      if (mimeType !== 'application/pdf' && mimeType !== 'text/plain' && !mimeType.startsWith('image/')) throw new Error('Preview is available for PDF, image and text documents.');
      setBatchPreview({ name: label + ': ' + name, url: URL.createObjectURL(data), mimeType });
    } catch (cause) {
      setToast('Could not preview saved document: ' + (cause instanceof Error ? cause.message : 'Please try again.'));
    } finally { setBatchPreviewBusyId(null); }
  };
  const openBatchPreview = async (file: BatchFile) => {
    if (!file.storagePath) { setToast('The original paper file is not available.'); return; }
    setBatchPreviewBusyId(file.id);
    try {
      const { data, error } = await supabase.storage.from('redpen-assessment-files').download(file.storagePath);
      if (error || !data) throw error || new Error('Could not download the paper.');
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const mimeType = data.type && data.type !== 'application/octet-stream' ? data.type : (extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'gif' ? 'image/gif' : 'image/jpeg');
      if (mimeType !== 'application/pdf' && !mimeType.startsWith('image/')) throw new Error('Preview is available for PDF and image papers only.');
      setBatchPreview({ name: file.name, url: URL.createObjectURL(data), mimeType });
    } catch (cause) {
      setToast('Could not preview paper: ' + (cause instanceof Error ? cause.message : 'Please try again.'));
    } finally { setBatchPreviewBusyId(null); }
  };
  useEffect(() => {
    if (!batchPreview?.url) return;
    const url = batchPreview.url;
    return () => URL.revokeObjectURL(url);
  }, [batchPreview]);
  const openResultForReview = async (result: Result) => {
    if (!result.assessmentId || !result.paperPath) {
      setToast('The saved paper for this assessment is unavailable, so it cannot be opened for review.');
      return;
    }
    setBatchReviewBusyId(result.assessmentId);
    try {
      const [{ data: assessment, error: assessmentError }, { data: paperBlob, error: paperError }] = await Promise.all([
        supabase.from('assessments').select('id,student_id,workbook_id,course_id,marking_scheme_path,answer_paper_path').eq('id', result.assessmentId).single(),
        supabase.storage.from('redpen-assessment-files').download(result.paperPath),
      ]);
      if (assessmentError || !assessment) throw assessmentError || new Error('Assessment record not found.');
      if (paperError || !paperBlob) throw paperError || new Error('Could not retrieve the original paper.');
      let schemeFile: File | null = null;
      if (assessment.marking_scheme_path) {
        const { data: schemeBlob, error: schemeError } = await supabase.storage.from('redpen-assessment-files').download(assessment.marking_scheme_path);
        if (schemeError || !schemeBlob) throw schemeError || new Error('Could not retrieve the marking scheme.');
        const schemeName = assessment.marking_scheme_path.split('/').pop() || 'marking-scheme.pdf';
        schemeFile = new File([schemeBlob], schemeName, { type: schemeBlob.type || (schemeName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') });
      }
      const paperName = result.paperName || 'student-paper.pdf';
      const paperType = paperBlob.type || (paperName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const paperFile = new File([paperBlob], paperName, { type: paperType });
      const aiLogResponse = await supabase.from('ai_grading_runs').select('provider,model,output_summary,status').eq('assessment_id', result.assessmentId).maybeSingle();
      const aiLog = aiLogResponse.data;
      if (paperUrl) URL.revokeObjectURL(paperUrl);
      setPaper(paperFile);
      setPaperAnnotations(result.paperAnnotations || {});
      setPaperUrl(URL.createObjectURL(paperBlob));
      setScheme(schemeFile);
      setNoScheme(!schemeFile);
      setStudent({ ...result.student });
      setQuestions(result.questions.map((question, index) => ({ ...question, id: question.id || uid(), label: question.label || 'Question ' + (index + 1) })));
      setOverallFeedback(result.feedback || '');
      setMode('ai');
      const output = aiLog?.output_summary && typeof aiLog.output_summary === 'object' ? aiLog.output_summary as any : {};
      setAiGradingMeta({
        provider: aiLog?.provider || 'AI provider', model: aiLog?.model || 'configured model',
        usage: null, needsReview: true,
        reviewNotes: Array.isArray(output.review_notes) ? output.review_notes : [],
      });
      setActiveWorkbookId(assessment.workbook_id || '');
      setActiveCourseId(assessment.course_id || '');
      setReviewContext({
        assessmentId: assessment.id, studentId: assessment.student_id,
        schemePath: assessment.marking_scheme_path || undefined,
        paperPath: assessment.answer_paper_path || undefined,
      });
      navigate('grade');
      setToast('Assessment loaded. Review and correct the marks, then save to update this existing result.');
    } catch (cause) {
      setToast('Could not open assessment for review: ' + (cause instanceof Error ? cause.message : 'Please try again.'));
    } finally { setBatchReviewBusyId(null); }
  };
  const openBatchReview = async (file: BatchFile) => {
    const result = results.find(item => item.paperPath === file.storagePath && item.assessmentId);
    if (!result) {
      setToast('The saved assessment for this paper could not be found. Please refresh the batch and try again.');
      return;
    }
    await openResultForReview(result);
  };
  const processBatch = async () => {
    if (!batchFiles.length) return;
    if (!activeCourse) { setToast('Select or create a course before processing this batch.'); return; }
    const jobs = [...new Set(batchFiles.map(file => file.batchJobId).filter((id): id is string => Boolean(id)))];
    if (!jobs.length) { setToast('No valid batch jobs were found.'); return; }
    setBatchBusy(true);
    let completed = 0;
    let needsReview = 0;
    try {
      for (const jobId of jobs) {
        const { data: job, error: jobError } = await supabase.from('batch_jobs').select('id,workbook_id,course_id,marking_scheme_path').eq('id', jobId).single();
        if (jobError || !job) { needsReview++; continue; }
        let schemeDoc = { text: '', images: [] as string[], warnings: [] as string[] };
        if (job.marking_scheme_path) {
          const { data: schemeBlob, error: schemeDownloadError } = await supabase.storage.from('redpen-assessment-files').download(job.marking_scheme_path);
          if (schemeDownloadError || !schemeBlob) { needsReview++; continue; }
          const schemeFile = new File([schemeBlob], job.marking_scheme_path.split('/').pop() || 'marking-scheme.pdf', { type: schemeBlob.type || 'application/pdf' });
          schemeDoc = await extractDocument(schemeFile);
        }
        const pending = batchFiles.filter(file => file.batchJobId === jobId && (file.status === 'Ready' || file.status === 'Failed'));
        await supabase.from('batch_jobs').update({ status: 'processing' }).eq('id', jobId);
        let jobCompleted = 0;
        for (const file of pending) {
          setBatchFiles(current => current.map(item => item.id === file.id ? { ...item, status: 'Processing' } : item));
          await supabase.from('batch_job_files').update({ status: 'processing', error_message: null }).eq('id', file.id);
          try {
            if (!file.storagePath) throw new Error('Paper file path is missing.');
            const { data: paperBlob, error: paperDownloadError } = await supabase.storage.from('redpen-assessment-files').download(file.storagePath);
            if (paperDownloadError || !paperBlob) throw paperDownloadError || new Error('Could not download paper.');
            const paperFile = new File([paperBlob], file.name, { type: paperBlob.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') });
            const paperDoc = await extractDocument(paperFile);
            const { data: graded, error: gradeError } = await supabase.functions.invoke('ai-grade', {
              body: { noScheme: !job.marking_scheme_path, schemeText: schemeDoc.text, schemeImages: schemeDoc.images, paperText: paperDoc.text, paperImages: paperDoc.images, sourceWarnings: [...schemeDoc.warnings, ...paperDoc.warnings] },
            });
            if (gradeError || graded?.error) throw new Error(graded?.error || gradeError?.message || 'AI grading failed.');
            const questions: Question[] = (graded.questions || []).map((q: any, i: number) => ({
              id: q.id || uid(), label: String(q.label || ('Question ' + (i + 1))),
              max: Number(q.max), score: Number(q.score), feedback: String(q.feedback || ''),
            }));
            if (!questions.length || questions.some(q => !Number.isFinite(q.max) || q.max <= 0 || !Number.isFinite(q.score) || q.score < 0 || q.score > q.max)) {
              throw new Error('AI returned invalid marks; paper needs manual review.');
            }
            const total = questions.reduce((sum, q) => sum + q.score, 0);
            const maximum = questions.reduce((sum, q) => sum + q.max, 0);
            const percent = maximum ? Math.round(total / maximum * 1000) / 10 : 0;
            const studentData = graded.student || {};
            const studentName = studentData.name || file.name.replace(/\.[^.]+$/, '');
            const { data: studentRow, error: studentError } = await supabase.from('students').insert({
              owner_id: user.id, full_name: studentName, student_number: studentData.id || null, class_name: studentData.className || null,
            }).select('id').single();
            if (studentError) throw studentError;
            const assessmentId = uid();
            const { error: assessmentError } = await supabase.from('assessments').insert({
              id: assessmentId, owner_id: user.id, workbook_id: job.workbook_id,
              course_id: job.course_id || activeCourse.id, student_id: studentRow.id,
              marking_scheme_path: job.marking_scheme_path, answer_paper_path: file.storagePath,
              paper_filename: file.name, status: (graded.needsReview || !job.marking_scheme_path) ? 'needs_review' : 'completed',
            });
            if (assessmentError) { await supabase.from('students').delete().eq('id', studentRow.id); throw assessmentError; }
            const { error: resultError } = await supabase.from('grading_results').insert({
              owner_id: user.id, assessment_id: assessmentId, score: total, maximum_score: maximum,
              percentage: percent, grade: gradeFor(percent), feedback: graded.overallFeedback || '',
              question_scores: questions,
            });
            if (resultError) { await supabase.from('assessments').delete().eq('id', assessmentId); throw resultError; }
            await supabase.from('ai_grading_runs').insert({
              owner_id: user.id, assessment_id: assessmentId, batch_job_id: jobId,
              provider: graded.provider || 'AI provider', model: graded.model || 'configured model',
              status: graded.needsReview ? 'needs_review' : 'completed',
              input_summary: { source_file: file.name, marking_scheme_supplied: Boolean(job.marking_scheme_path) },
              output_summary: { question_count: questions.length, percentage: percent, review_required: Boolean(graded.needsReview || !job.marking_scheme_path), review_notes: graded.reviewNotes || [] },
            });
            const fileStatus = (graded.needsReview || !job.marking_scheme_path) ? 'needs_review' : 'completed';
            const { error: fileUpdateError } = await supabase.from('batch_job_files').update({
              status: fileStatus, detected_student_name: studentName,
              error_message: (graded.needsReview || !job.marking_scheme_path) ? [...(graded.reviewNotes || []), ...(!job.marking_scheme_path ? ['No official marking scheme supplied; AI-generated criteria require teacher approval.'] : [])].join('; ') : null,
            }).eq('id', file.id);
            if (fileUpdateError) throw fileUpdateError;
            const result: Result = {
              id: assessmentId, assessmentId, courseId: job.course_id || activeCourse.id, workbookId: job.workbook_id || activeWorkbook?.id,
              institutionName: workbooks.find(w => w.id === job.workbook_id)?.institution || activeWorkbook?.institution || '', schemePath: job.marking_scheme_path, paperPath: file.storagePath,
              student: { name: studentName, id: studentData.id || '', className: studentData.className || '' },
              courseName: workbooks.find(w => w.id === job.workbook_id)?.courses.find(course => course.id === job.course_id)?.name || activeCourse.name,
              workbookName: workbooks.find(w => w.id === job.workbook_id)?.name || activeWorkbook?.name || '',
              date: new Date().toISOString(), questions, total, maximum, percentage: percent, grade: gradeFor(percent),
              feedback: graded.overallFeedback || '', paperName: file.name,
            };
            setResults(current => [result, ...current]);
            setBatchFiles(current => current.map(item => item.id === file.id ? { ...item, status: (graded.needsReview || !job.marking_scheme_path) ? 'Needs review' : 'Completed' } : item));
            if (graded.needsReview) needsReview++;
            completed++;
            jobCompleted++;
          } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Processing failed.';
            await supabase.from('batch_job_files').update({ status: 'failed', error_message: message }).eq('id', file.id);
            setBatchFiles(current => current.map(item => item.id === file.id ? { ...item, status: 'Failed' } : item));
            needsReview++;
          }
          await supabase.from('batch_jobs').update({ completed_files: jobCompleted }).eq('id', jobId);
        }
        await supabase.from('batch_jobs').update({ status: 'completed', completed_files: jobCompleted }).eq('id', jobId);
      }
      setToast('Batch finished: ' + completed + ' paper(s) graded; ' + needsReview + ' need attention.');
    } finally {
      setBatchBusy(false);
    }
  };
  const removeUnreferencedAssessmentFiles = async (paths: string[]) => {
    const candidates = [...new Set(paths.filter(Boolean))];
    if (!candidates.length) return;
    const [paperRefs, schemeRefs] = await Promise.all([
      supabase.from('assessments').select('answer_paper_path').in('answer_paper_path', candidates),
      supabase.from('assessments').select('marking_scheme_path').in('marking_scheme_path', candidates),
    ]);
    if (paperRefs.error || schemeRefs.error) {
      console.warn('Skipped document cleanup because assessment references could not be checked.', paperRefs.error || schemeRefs.error);
      return;
    }
    const referenced = new Set([...(paperRefs.data || []).map(row => row.answer_paper_path), ...(schemeRefs.data || []).map(row => row.marking_scheme_path)].filter(Boolean));
    const removable = candidates.filter(path => !referenced.has(path));
    if (removable.length) {
      const { error } = await supabase.storage.from('redpen-assessment-files').remove(removable);
      if (error) console.warn('Could not remove unreferenced assessment documents:', error.message);
    }
  };
  const deleteBatchFile = async (id: string) => {
    const file = batchFiles.find(item => item.id === id);
    const { error } = await supabase.from('batch_job_files').delete().eq('id', id);
    if (error) { setToast(`Could not remove paper: ${error.message}`); return; }
    if (file?.storagePath) await removeUnreferencedAssessmentFiles([file.storagePath]);
    setBatchFiles(current => current.filter(item => item.id !== id));
  };
  const clearBatch = async () => {
    if (!batchFiles.length) return;
    const ids = batchFiles.map(file => file.id);
    const paths = batchFiles.map(file => file.storagePath).filter((path): path is string => Boolean(path));
    const { error } = await supabase.from('batch_job_files').delete().in('id', ids);
    if (error) { setToast(`Could not clear batch: ${error.message}`); return; }
    if (paths.length) await removeUnreferencedAssessmentFiles(paths);
    setBatchFiles([]);
  };
  const deleteResult = async (id: string) => {
    const row = results.find(item => item.id === id);
    if (row?.assessmentId) {
      const { error } = await supabase.from('assessments').delete().eq('id', row.assessmentId);
      if (error) { setToast(`Could not delete result: ${error.message}`); return; }
      const paths = [row.schemePath, row.paperPath].filter((path): path is string => Boolean(path));
      if (paths.length) await removeUnreferencedAssessmentFiles(paths);
    }
    setResults(current => current.filter(item => item.id !== id));
    setToast('Grading record deleted.');
  };

  const createInstitution = async () => {
    if (!institutionName.trim()) { setToast('Enter an institution name.'); return; }
    setInstitutionBusy(true);
    const { data, error } = await supabase.from('institutions').insert({ owner_id: user.id, name: institutionName.trim() }).select('id,name,owner_id').single();
    setInstitutionBusy(false);
    if (error) { setToast('Could not create institution: ' + error.message); return; }
    setInstitutions(current => [data, ...current]);
    setActiveInstitutionId(data.id);
    setInstitutionName('');
    setToast('Institution created. You are its owner.');
  };
  const addInstitutionMember = async () => {
    if (!activeInstitutionId || !memberEmail.trim()) { setToast('Choose an institution and enter a teacher email.'); return; }
    setInstitutionBusy(true);
    const { data, error } = await supabase.functions.invoke('institution-admin', {
      body: { action: 'add_member', institutionId: activeInstitutionId },
      headers: { 'x-redpen-member-email': memberEmail.trim(), 'x-redpen-member-role': 'teacher' },
    });
    setInstitutionBusy(false);
    if (error || data?.error) { setToast(data?.error || error?.message || 'Could not add teacher.'); return; }
    setMembers(current => [...current.filter(m => m.id !== data.member.id), data.member]);
    setMemberEmail('');
    setToast('Teacher added to the institution workspace.');
  };
  const removeInstitutionMember = async (membershipId: string) => {
    if (!activeInstitutionId) return;
    setInstitutionBusy(true);
    const { data, error } = await supabase.functions.invoke('institution-admin', {
      body: { action: 'remove_member', institutionId: activeInstitutionId },
      headers: { 'x-redpen-membership-id': membershipId },
    });
    setInstitutionBusy(false);
    if (error || data?.error) { setToast(data?.error || error?.message || 'Could not remove teacher.'); return; }
    setMembers(current => current.filter(m => m.id !== membershipId));
    setToast('Teacher access removed.');
  };

  const nav = [{ id:'dashboard' as Screen, label:'Dashboard', icon:LayoutDashboard }, { id:'grade' as Screen, label:'Grade', icon:ClipboardList }, { id:'results' as Screen, label:'Results', icon:FileText }, { id:'history' as Screen, label:'History', icon:Clock3 }, { id:'batch' as Screen, label:'Batch grading', icon:LayersIcon }, { id:'institutions' as Screen, label:'Institutions', icon:Users }, { id:'settings' as Screen, label:'Settings', icon:Settings }];
  const title = nav.find(n => n.id === screen)?.label || 'Dashboard';

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><img src={logo} alt="RedPen" /><span>RedPen</span><button className="icon-button mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="mode-switch"><span>MARKING MODE</span><div><button className={mode==='ai'?'selected':''} onClick={() => setMode('ai')}> <Sparkles size={14}/> AI</button><button className={mode==='manual'?'selected':''} onClick={() => setMode('manual')}><FileText size={14}/> Manual</button></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(item => <button key={item.id} className={screen===item.id?'nav-item active':'nav-item'} onClick={() => navigate(item.id)}><item.icon size={18}/><span>{item.label}</span>{item.id==='results' && results.length>0 && <small>{results.length}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><strong>Need a hand?</strong><p>Ask Yaza for help using RedPen.</p><button onClick={() => setYazaOpen(true)}>Ask Yaza <ChevronRight size={14}/></button></div><div className="user-row"><div className="avatar">{(user.email || 'RP').slice(0,2).toUpperCase()}</div><div><strong>{user.email || 'RedPen account'}</strong><small>Cloud workspace</small></div><MoreHorizontal size={17}/></div></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={19}/></button><div className="crumb"><span>Workspace</span><ChevronRight size={14}/><strong>{title}</strong></div></div><div className="topbar-actions"><label className="search-box"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search students, results..."/><kbd>⌘ K</kbd></label><button className="icon-button" onClick={() => setYazaOpen(true)} title="Yaza AI"><Bot size={18}/></button><button className="icon-button" onClick={() => navigate('settings')} title="Settings"><Settings size={18}/></button><button className="icon-button" onClick={() => { void supabase.auth.signOut(); }} title="Sign out"><LogOut size={18}/></button></div></header>
      <div className="page-content">
        {screen==='dashboard' && <Dashboard workbooks={workbooks} results={results} activeWorkbook={activeWorkbook} activeCourse={activeCourse} onStart={startGrading} onNewWorkbook={() => setModal('workbook')} onNewCourse={() => setModal('course')} onNavigate={navigate} onSelectWorkbook={id => { setActiveWorkbookId(id); const c=workbooks.find(w=>w.id===id)?.courses[0]; setActiveCourseId(c?.id||''); }}/>}
        {screen==='grade' && <section className="screen-stack"><PageHeading eyebrow="MARKING WORKSPACE" title="Grade a paper" description="Set up the assessment, review the student's paper and record marks."/><div className="context-strip"><div><BookOpen size={16}/><span>{activeWorkbook?.name || 'No workbook selected'}</span><ChevronDown size={13}/></div><span className="strip-dot"/><span>{activeCourse ? activeCourse.code+' · '+activeCourse.name : 'No course selected'}</span><button onClick={() => setModal(activeWorkbook?'course':'workbook')}>{activeWorkbook?'Add course':'Create workbook'}</button></div>
          <div className="grade-grid"><div className="grade-main"><div className="panel"><PanelTitle number="01" title="Student information" subtitle="Identify whose paper you are marking."/><div className="form-grid"><Field label="Student name"><input value={student.name} onChange={e=>setStudent(s=>({...s,name:e.target.value}))} placeholder="Enter full name"/></Field><Field label="Student ID / Examination number"><input value={student.id} onChange={e=>setStudent(s=>({...s,id:e.target.value}))} placeholder="e.g. MSCE-2026-001"/></Field><Field label="Class / Form" wide><input value={student.className} onChange={e=>setStudent(s=>({...s,className:e.target.value}))} placeholder="e.g. Form 4"/></Field></div></div>
          <div className="panel"><PanelTitle number="02" title="Assessment materials" subtitle="Use an official scheme or let AI propose provisional criteria."/><label className="no-scheme-choice"><input type="checkbox" checked={noScheme} onChange={e=>{setNoScheme(e.target.checked);if(e.target.checked)setScheme(null);}}/><span><strong>No marking scheme</strong><small>AI will propose criteria and maximum marks from the questions. Teacher review is mandatory.</small></span></label><div className="upload-grid">{!noScheme && <UploadCard label="Marking scheme" hint="PDF, image or text · up to 25 MB" file={scheme} onFile={setScheme}/>}<UploadCard label="Student answer paper" hint="PDF or image · up to 25 MB" file={paper} onFile={file=>file?onPaper(file):setPaper(null)}/></div></div>
          <div className="panel"><PanelTitle number="03" title="Paper annotation" subtitle="Mark directly on the original paper. Your ink, ticks and notes are saved with this assessment."/><ManualPaperCanvas file={paper} annotations={paperAnnotations} onChange={setPaperAnnotations}/></div><div className="panel"><div className="panel-heading"><PanelTitle number="04" title="Question-by-question marking" subtitle="Enter marks awarded against the marking scheme."/><span className="manual-pill">{mode === "ai" ? <Sparkles size={13}/> : <ShieldCheck size={13}/>} {mode === "ai" ? "AI-assisted draft" : "Manual assessment"}</span></div><div className="notice"><InfoIcon/> {mode === "ai" ? "AI has drafted marks against the uploaded scheme. Review every question and adjust any mark before saving." : "Marks are entered by the marker. RedPen calculates totals and grades; it does not automatically assess the uploaded paper in this mode."}</div><div className="question-list">{questions.map((q,i)=><div className="question-row" key={q.id}><div className="question-index">{String(i+1).padStart(2,'0')}</div><div className="question-fields"><input className="question-label" value={q.label} onChange={e=>updateQuestion(q.id,{label:e.target.value})}/><div className="question-inputs"><label><span>AWARDED</span><input type="number" min="0" max={q.max} value={q.score} onChange={e=>updateQuestion(q.id,{score:Number(e.target.value)})}/></label><span className="out-of">/</span><label><span>MAXIMUM</span><input type="number" min="1" value={q.max} onChange={e=>updateQuestion(q.id,{max:Number(e.target.value)})}/></label></div><input className="feedback-input" value={q.feedback} onChange={e=>updateQuestion(q.id,{feedback:e.target.value})} placeholder="Feedback for this question (optional)"/></div><button className="icon-button danger-quiet" onClick={()=>setQuestions(current=>current.filter(x=>x.id!==q.id))} title="Remove question"><Trash2 size={15}/></button></div>)}</div><button className="text-action" onClick={addQuestion}><Plus size={15}/> Add question</button></div>
          <div className="panel"><PanelTitle number="05" title="Overall feedback" subtitle="Add a summary comment for the student (optional)."/><textarea className="textarea" rows={3} value={overallFeedback} onChange={e=>setOverallFeedback(e.target.value)} placeholder="Write constructive feedback..."/></div>
          <div className="grade-footer"><div className="score-preview"><span>LIVE TOTAL</span><strong>{earnedMarks} <small>/ {totalMarks}</small></strong><em>{percentage}% · {gradeFor(percentage)}</em></div><div className="grade-actions">{mode === "ai" && <button className="secondary-button" onClick={() => runAiGrading()} disabled={aiBusy || (!scheme && !noScheme) || !paper}>{aiBusy ? <span className="spin-inline"/> : <Sparkles size={16}/>} {aiBusy ? "Marking…" : "Run AI marking"}</button>}<button className="primary-button" onClick={saveResult}><Save size={16}/> Save grading result</button></div></div>
          </div><aside className="grade-aside"><div className="panel preview-panel"><div className="aside-title"><span>STUDENT PAPER</span><span className={paper?'status-ready':'status-pending'}>{paper?'UPLOADED':'AWAITING FILE'}</span></div>{paperUrl && paper?.type.startsWith('image/')?<img className="paper-image" src={paperUrl} alt="Student paper preview"/>:paperUrl && paper?.type==='application/pdf'?<iframe className="paper-frame" src={paperUrl} title="Student paper preview"/>:<div className="paper-empty"><FileText size={34}/><strong>No paper uploaded</strong><span>Upload a PDF or image to preview it here.</span></div>}{paper && <div className="file-meta"><FileText size={14}/><span>{paper.name}</span></div>}</div><div className="panel scheme-summary"><div className="aside-title">MARKING SCHEME</div>{noScheme?<p>AI-generated criteria · teacher approval required.</p>:scheme?<div className="file-meta"><CheckCircle2 size={15}/><span>{scheme.name}</span></div>:<p>No marking scheme uploaded yet.</p>}<div className="divider"/><div className="summary-line"><span>Questions</span><strong>{questions.length}</strong></div><div className="summary-line"><span>Total possible marks</span><strong>{totalMarks}</strong></div></div><div className="ai-note"><Sparkles size={17}/><div><strong>AI-assisted marking</strong><p>{aiGradingMeta ? ("Drafted with " + aiGradingMeta.provider + " · " + aiGradingMeta.model + ". Check all marks before saving.") : "Upload a scheme and answer paper, choose AI mode, then run AI marking. Review the draft before saving."}</p></div></div></aside></div></section>}
        {screen==='results' && <section className="screen-stack"><PageHeading eyebrow="ASSESSMENT OUTPUT" title="Results" description="Filter saved assessments by course, institution or workbook, then export exactly the records shown."/><div className="panel results-filter-panel"><div className="results-filter-heading"><div><strong>Choose results</strong><span>Combine filters to narrow the records shown and exported.</span></div><button className="text-action" onClick={()=>{setResultCourseFilter('');setResultInstitutionFilter('');setResultWorkbookFilter('');setSearch('');}}>Clear filters</button></div><div className="results-filter-grid"><Field label="Course"><select value={resultCourseFilter} onChange={e=>setResultCourseFilter(e.target.value)}><option value="">All courses</option>{resultCourses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Institution"><select value={resultInstitutionFilter} onChange={e=>setResultInstitutionFilter(e.target.value)}><option value="">All institutions</option>{resultInstitutions.map(name=><option key={name} value={name}>{name}</option>)}</select></Field><Field label="Workbook"><select value={resultWorkbookFilter} onChange={e=>setResultWorkbookFilter(e.target.value)}><option value="">All workbooks</option>{resultWorkbooks.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div><div className="results-filter-footer"><span>{filteredResults.length} of {results.length} results selected</span><div className="report-actions"><button className="secondary-button" onClick={() => void exportResultsExcel(filteredResults.map(r => ({student:r.student.name,studentId:r.student.id,course:r.courseName,institution:r.institutionName || '',workbook:r.workbookName,date:formatDate(r.date),score:r.total,maximum:r.maximum,percentage:r.percentage,grade:r.grade,feedback:r.feedback})))} disabled={!filteredResults.length}><FileText size={15}/> Export Excel</button><button className="secondary-button" onClick={() => exportResultsPdf(filteredResults.map(r => ({student:r.student.name,studentId:r.student.id,course:r.courseName,institution:r.institutionName || '',workbook:r.workbookName,date:formatDate(r.date),score:r.total,maximum:r.maximum,percentage:r.percentage,grade:r.grade,feedback:r.feedback})))} disabled={!filteredResults.length}><Printer size={15}/> Export PDF</button></div></div></div><div className="metric-grid compact"><Metric icon={Users} label="Students assessed" value={filteredResults.length}/><Metric icon={BarChart3} label="Average score" value={filteredResults.length?Math.round(filteredResults.reduce((s,r)=>s+r.percentage,0)/filteredResults.length)+'%':'—'}/><Metric icon={Award} label="Pass rate" value={filteredResults.length?Math.round(filteredResults.filter(r=>r.percentage>=50).length/filteredResults.length*100)+'%':'—'}/></div><ResultsTable rows={filteredResults} onDelete={deleteResult} onPreview={openSavedDocumentPreview} previewBusyId={batchPreviewBusyId} onReview={openResultForReview} reviewBusyId={batchReviewBusyId}/></section>}
        {screen==='history' && <section className="screen-stack"><PageHeading eyebrow="YOUR WORK" title="Grading history" description="Find previous assessments and continue reviewing their records."/><ResultsTable rows={filteredResults} onDelete={deleteResult} onPreview={openSavedDocumentPreview} previewBusyId={batchPreviewBusyId} onReview={openResultForReview} reviewBusyId={batchReviewBusyId} history/></section>}
        {screen==='batch' && <section className="screen-stack"><PageHeading eyebrow="MULTIPLE PAPERS" title="Batch grading" description="Prepare a group of student papers for assessment."/><div className="panel batch-panel"><div className="batch-scheme"><label className="no-scheme-choice"><input type="checkbox" checked={batchNoScheme} onChange={e=>{setBatchNoScheme(e.target.checked);if(e.target.checked)setBatchScheme(null);}}/><span><strong>No marking scheme</strong><small>AI will propose provisional criteria for each paper. All results require teacher review.</small></span></label>{!batchNoScheme && <><Field label="Marking scheme for this batch"><input type="file" accept=".pdf,image/*,.txt" onChange={e => setBatchScheme(e.target.files?.[0] || null)}/></Field><span>{batchScheme ? ("Selected: " + batchScheme.name) : "One marking scheme is applied to every paper in each upload batch."}</span></>}</div><label className="batch-drop"><input type="file" multiple accept=".pdf,image/*" onChange={e=>addBatch(e.target.files)}/><div className="upload-circle"><Upload size={22}/></div><strong>Drop student papers here</strong><span>or browse files · PDF and images · 25 MB per file</span></label>{batchFiles.length>0?<><div className="batch-head"><strong>{batchFiles.length} files added</strong><button className="text-action danger-text" onClick={clearBatch}>Remove all</button></div>{batchFiles.map(f=><div className="batch-file" key={f.id}><FileText size={17}/><span>{f.name}<small>{(f.size/1024/1024).toFixed(2)} MB</small></span><em>{f.status}</em><button className="batch-preview-button" onClick={()=>void openBatchPreview(f)} disabled={!f.storagePath || batchPreviewBusyId===f.id} title="Preview original paper">{batchPreviewBusyId===f.id?<span className="spin-inline"/>:<Eye size={14}/>}<span>{batchPreviewBusyId===f.id?'Loading':'Preview'}</span></button>{(f.status==='Completed'||f.status==='Needs review') && <button className="batch-review-button" onClick={()=>void openBatchReview(f)} disabled={batchReviewBusyId===f.id} title="Open assessment in Grade workspace">{batchReviewBusyId===f.id?<span className="spin-inline"/>:<ClipboardList size={14}/>}<span>{batchReviewBusyId===f.id?'Opening':'Open for Review'}</span></button>}<button className="icon-button" onClick={()=>deleteBatchFile(f.id)} title="Remove paper"><X size={15}/></button></div>)}<div className="notice"><InfoIcon/> Papers are processed one at a time. AI-extracted student details and marks are saved to your workspace; uncertain papers are flagged for review.</div><button className="primary-button batch-process" onClick={processBatch} disabled={batchBusy || !batchFiles.some(f => f.status === "Ready" || f.status === "Failed")}>{batchBusy ? <span className="spin-inline"/> : <Sparkles size={16}/>} {batchBusy ? "Processing papers…" : "Process batch with AI"}</button></>:<div className="empty-inline">No papers added yet. Choose several files to prepare a batch.</div>}</div></section>}
        {screen==='institutions' && <section className="screen-stack"><PageHeading eyebrow="TEAM WORKSPACES" title="Institutions" description="Create a shared institution workspace and give registered teachers access to its workbooks and results."/><div className="institution-grid"><div className="panel"><PanelTitle number="01" title="Create an institution" subtitle="The creator becomes the institution owner."/><div className="institution-create"><Field label="Institution name"><input value={institutionName} onChange={e=>setInstitutionName(e.target.value)} placeholder="e.g. Lilongwe Secondary School"/></Field><button className="primary-button" onClick={createInstitution} disabled={institutionBusy}><Plus size={15}/> Create institution</button></div><div className="divider"/><Field label="Select institution"><select value={activeInstitutionId} onChange={e=>setActiveInstitutionId(e.target.value)}><option value="">Choose an institution</option>{institutions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><p className="institution-hint">When you create a workbook, the selected institution is attached to it so its teachers can collaborate.</p></div><div className="panel"><PanelTitle number="02" title="Teacher access" subtitle="Add teachers who already have RedPen accounts."/><form className="institution-create" onSubmit={e=>{e.preventDefault();void addInstitutionMember();}}><Field label="Teacher email address"><input type="email" value={memberEmail} onChange={e=>setMemberEmail(e.target.value)} placeholder="teacher@school.edu"/></Field><button className="primary-button" type="submit" disabled={institutionBusy || !activeInstitutionId}><Users size={15}/> Add teacher</button></form><p className="institution-hint">Teachers must register for RedPen first. Only the institution owner or an administrator can manage membership.</p><div className="member-list">{members.map(member=><div className="member-row" key={member.id}><div className="member-avatar">{String(member.name || member.email || 'T').slice(0,1).toUpperCase()}</div><div><strong>{member.name || member.email || 'RedPen teacher'}</strong><small>{member.email} · {member.member_role}</small></div>{member.member_role!=='owner' && <button className="icon-button danger-quiet" onClick={()=>void removeInstitutionMember(member.id)} disabled={institutionBusy} title="Remove access"><Trash2 size={15}/></button>}</div>)}{activeInstitutionId && !members.length && <div className="empty-inline">No member list is available. You need to own this institution or be an administrator to manage its teachers.</div>}{!activeInstitutionId && <div className="empty-inline">Create or select an institution to manage its teachers.</div>}</div></div></div></section>}
        {screen==='settings' && <section className="screen-stack"><PageHeading eyebrow="PREFERENCES" title="Settings" description="Manage your secure RedPen cloud workspace."/><div className="settings-grid"><div className="panel"><PanelTitle number="01" title="Workspace storage" subtitle="Your records are synchronised to your private RedPen cloud workspace."/><div className="settings-row"><div><strong>Supabase cloud workspace</strong><p>Workbooks, courses and grading results are backed up to your private RedPen database.</p></div><span className="connection-pill"><span/> Active</span></div><div className="settings-row"><div><strong>Export your data</strong><p>Download a backup of your workbooks and grading records.</p></div><button className="secondary-button" onClick={()=>{const blob=new Blob([JSON.stringify({workbooks,results},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='redpen-backup.json';a.click();URL.revokeObjectURL(a.href);}}>Export backup</button></div></div><div className="panel"><PanelTitle number="02" title="Integrations" subtitle="Core RedPen cloud services are connected."/><div className="integration-row"><div className="integration-icon"><Sparkles size={17}/></div><div><strong>AI grading provider</strong><p>Secure Edge Function deployed. Add AI_API_KEY, AI_PROVIDER and AI_MODEL in Supabase Edge Function Secrets to activate marking.</p></div><span className="status-pending">AWAITING SECRET</span></div><div className="integration-row"><div className="integration-icon"><Archive size={17}/></div><div><strong>Supabase authentication & storage</strong><p>Sign-in, cloud sync and private assessment-file storage are active.</p></div><span className="connection-pill"><span/> CONNECTED</span></div></div></div></section>}
      </div>
    </main>
    {yazaOpen && <div className="yaza-panel"><div className="yaza-head"><div className="yaza-brand"><div><Bot size={18}/></div><span><strong>Yaza AI</strong><small>RedPen guide</small></span></div><button className="icon-button" onClick={()=>setYazaOpen(false)}><X size={18}/></button></div><div className="yaza-messages">{yazaMessages.map((m,i)=><div key={i} className={m.role==='user'?'yaza-message user-message':'yaza-message'}>{m.text}</div>)}{yazaBusy&&<div className="yaza-thinking"><span className="spin-inline"/> Yaza is thinking and checking available actions…</div>}</div><form className="yaza-compose" onSubmit={e=>{e.preventDefault();void sendYaza();}}><input value={yazaInput} onChange={e=>setYazaInput(e.target.value)} placeholder="Ask Yaza to navigate, edit marks, add questions…"/><button className="primary-button" type="submit" disabled={!yazaInput.trim()||yazaBusy}>{yazaBusy?<span className="spin-inline"/>:<ChevronRight size={17}/>}</button></form></div>}
    {modal && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}><form className="modal-card" onSubmit={e=>{e.preventDefault();modal==='workbook'?addWorkbook():addCourse();}}><div className="modal-head"><div><span className="eyebrow">{modal==='workbook'?'WORKBOOK SETUP':'COURSE SETUP'}</span><h2>{modal==='workbook'?'Create a workbook':'Add a course'}</h2></div><button type="button" className="icon-button" onClick={()=>setModal(null)}><X size={18}/></button></div><p className="modal-description">{modal==='workbook'?'A workbook keeps related courses and student assessments together.':'Add a subject or class to the currently selected workbook.'}</p>{modal==='workbook'?<><Field label="Workbook name"><input autoFocus required value={workbookName} onChange={e=>setWorkbookName(e.target.value)} placeholder="e.g. 2026 MSCE Examinations"/></Field><Field label="Institution (optional)"><input value={institution} onChange={e=>setInstitution(e.target.value)} placeholder="School or institution"/></Field><Field label="Share with institution"><select value={activeInstitutionId} onChange={e=>setActiveInstitutionId(e.target.value)}><option value="">Personal workspace</option>{institutions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></>:<><Field label="Course code (optional)"><input value={courseCode} onChange={e=>setCourseCode(e.target.value)} placeholder="e.g. BIO 101"/></Field><Field label="Course name"><input autoFocus required value={courseName} onChange={e=>setCourseName(e.target.value)} placeholder="e.g. Biology"/></Field></>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setModal(null)}>Cancel</button><button type="submit" className="primary-button"><Plus size={15}/>{modal==='workbook'?'Create workbook':'Add course'}</button></div></form></div>}
    {batchPreview && <div className="paper-preview-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setBatchPreview(null);}}><section className="paper-preview-modal" role="dialog" aria-modal="true" aria-label={'Document preview: '+batchPreview.name}><header className="paper-preview-header"><div><span className="eyebrow">SAVED DOCUMENT PREVIEW</span><strong>{batchPreview.name}</strong></div><button className="icon-button" onClick={()=>setBatchPreview(null)} aria-label="Close paper preview"><X size={19}/></button></header><div className="paper-preview-content">{batchPreview.mimeType==='application/pdf'||batchPreview.mimeType==='text/plain'?<iframe src={batchPreview.url} title={'Preview of '+batchPreview.name}/>:<img src={batchPreview.url} alt={'Preview of '+batchPreview.name}/>}</div><footer className="paper-preview-footer"><span>Original saved document · Private, read-only preview</span><button className="secondary-button" onClick={()=>setBatchPreview(null)}>Close preview</button></footer></section></div>}
    {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
  </div>;
}
function LayersIcon(props:any){return <Layers {...props}/>}
function PageHeading({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="heading-mark"><GraduationCap size={25}/></div></div>}
function PanelTitle({number,title,subtitle}:{number:string;title:string;subtitle:string}){return <div className="panel-title"><span>{number}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div>}
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <label className={wide?'field wide':'field'}><span>{label}</span>{children}</label>}
function UploadCard({label,hint,file,onFile}:{label:string;hint:string;file:File|null;onFile:(file:File|null)=>void}){return <div className="upload-card"><div className="upload-card-top"><strong>{label}</strong>{file&&<button className="icon-button" onClick={()=>onFile(null)}><X size={14}/></button>}</div><label className="upload-select"><input type="file" accept=".pdf,image/*,.txt" onChange={e=>onFile(e.target.files?.[0]||null)}/><div className="upload-circle"><Upload size={19}/></div><b>{file?file.name:'Choose a file'}</b><span>{file?'Click to replace':hint}</span></label></div>}
function InfoIcon(){return <CircleHelp size={16}/>}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string|number}){return <div className="metric-card"><div className="metric-icon"><Icon size={17}/></div><span>{label}</span><strong>{value}</strong></div>}
function Dashboard({workbooks,results,activeWorkbook,activeCourse,onStart,onNewWorkbook,onNewCourse,onNavigate,onSelectWorkbook}:{workbooks:Workbook[];results:Result[];activeWorkbook:Workbook|null;activeCourse:Course|null;onStart:()=>void;onNewWorkbook:()=>void;onNewCourse:()=>void;onNavigate:(s:Screen)=>void;onSelectWorkbook:(id:string)=>void}) {
 const avg=results.length?Math.round(results.reduce((s,r)=>s+r.percentage,0)/results.length):0;
 return <section className="screen-stack"><div className="welcome-banner"><div><span className="eyebrow">YOUR MARKING WORKSPACE</span><h1>Good work starts with<br/><em>clear assessment.</em></h1><p>Organise your marking, assess student papers and keep every result in one place.</p><div className="welcome-actions"><button className="primary-button" onClick={onStart}><Plus size={16}/> Start grading</button><button className="light-button" onClick={onNewWorkbook}><FolderOpen size={16}/> New workbook</button></div></div><div className="welcome-art"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><div className="art-sheet"><div className="sheet-top"><span/><span/></div><div className="sheet-line long"/><div className="sheet-line"/><div className="sheet-mark"><Check size={24}/></div><div className="sheet-line short"/></div><div className="art-badge"><Award size={18}/><span>ASSESS<br/>WITH CARE</span></div></div></div>
 <div className="metric-grid"><Metric icon={BookOpen} label="Workbooks" value={workbooks.length}/><Metric icon={Users} label="Students assessed" value={results.length}/><Metric icon={BarChart3} label="Average score" value={results.length?avg+'%':'—'}/><Metric icon={Activity} label="Pass rate" value={results.length?Math.round(results.filter(r=>r.percentage>=50).length/results.length*100)+'%':'—'}/></div>
 <div className="dashboard-columns"><div className="panel"><div className="section-heading"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Your workbooks</h2></div><button className="text-action" onClick={onNewWorkbook}><Plus size={15}/> New</button></div>{workbooks.length?workbooks.map(w=><button className={'workbook-row '+(w.id===activeWorkbook?.id?'workbook-active':'')} key={w.id} onClick={()=>onSelectWorkbook(w.id)}><div className="workbook-icon"><BookOpen size={18}/></div><span><strong>{w.name}</strong><small>{w.institution||'Personal workspace'} · {w.courses.length} courses</small></span><ChevronRight size={17}/></button>):<div className="empty-inline">Create a workbook to organise your courses and results.</div>}<button className="outline-wide" onClick={onNewCourse} disabled={!activeWorkbook}>Add course to selected workbook</button></div><div className="panel"><div className="section-heading"><div><span className="eyebrow">CURRENT SELECTION</span><h2>Grading setup</h2></div><div className="selection-icon"><GraduationCap size={18}/></div></div><div className="selection-block"><small>ACTIVE WORKBOOK</small><strong>{activeWorkbook?.name||'No workbook selected'}</strong></div><div className="selection-block"><small>ACTIVE COURSE</small><strong>{activeCourse?activeCourse.code+' · '+activeCourse.name:'No course selected'}</strong></div><button className="primary-button full-button" onClick={onStart}><ClipboardList size={16}/> Open grading workspace</button></div></div>
 <div className="panel"><div className="section-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Latest assessments</h2></div><button className="text-action" onClick={()=>onNavigate('history')}>View history <ChevronRight size={14}/></button></div>{results.slice(0,4).length?results.slice(0,4).map(r=><div className="recent-row" key={r.id}><div className="recent-avatar">{r.student.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</div><span><strong>{r.student.name}</strong><small>{r.courseName} · {formatDate(r.date)}</small></span><b>{r.percentage}%</b><em>{r.grade}</em></div>):<div className="empty-inline">No assessments saved yet. Your recent grading activity will appear here.</div>}</div></section>;
}
function ResultsTable({rows,onDelete,onPreview,previewBusyId,onReview,reviewBusyId,history=false}:{rows:Result[];onDelete:(id:string)=>void;onPreview:(path:string|undefined,name:string,label:string)=>void;previewBusyId:string|null;onReview:(result:Result)=>void;reviewBusyId:string|null;history?:boolean}){return <div className="panel table-panel"><div className="section-heading"><div><span className="eyebrow">{history?'SAVED RECORDS':'ALL ASSESSMENTS'}</span><h2>{history?'Assessment history':'Student results'}</h2></div><span className="count-pill">{rows.length} records</span></div>{rows.length?<div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>COURSE</th><th>DATE</th><th>SCORE</th><th>GRADE</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.student.name}</strong><small>{r.student.id||'No student ID'}</small></td><td>{r.courseName}</td><td>{formatDate(r.date)}</td><td><strong>{r.total}/{r.maximum}</strong><small>{r.percentage}%</small></td><td><span className="grade-chip">{r.grade}</span></td><td><div className="result-row-actions">{r.assessmentId&&r.paperPath&&<button className="batch-review-button" onClick={()=>onReview(r)} disabled={reviewBusyId===r.assessmentId} title="Open this saved assessment in the Grade workspace">{reviewBusyId===r.assessmentId?<span className="spin-inline"/>:<ClipboardList size={14}/>}<span>{reviewBusyId===r.assessmentId?'Opening':'Open for Review'}</span></button>}{r.paperPath&&<button className="batch-preview-button" onClick={()=>onPreview(r.paperPath,r.paperName||'student-paper.pdf','Student paper')} disabled={previewBusyId==='saved-'+r.paperPath} title="Preview saved student paper">{previewBusyId==='saved-'+r.paperPath?<span className="spin-inline"/>:<Eye size={14}/>}<span>Paper</span></button>}{r.schemePath&&<button className="batch-preview-button" onClick={()=>onPreview(r.schemePath,'marking-scheme.pdf','Marking scheme')} disabled={previewBusyId==='saved-'+r.schemePath} title="Preview saved marking scheme">{previewBusyId==='saved-'+r.schemePath?<span className="spin-inline"/>:<Eye size={14}/>}<span>Scheme</span></button>}<button className="icon-button danger-quiet" onClick={()=>onDelete(r.id)} title="Delete record"><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>:<div className="empty-state"><div><FileText size={27}/></div><strong>No saved results yet</strong><p>Complete a grading session and save it to see the student's assessment here.</p></div>}</div>}
export default App;
