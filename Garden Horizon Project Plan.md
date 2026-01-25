Garden Horizon Project Plan

Introduction

Garden Horizon is a comprehensive goal-planning and productivity app that connects your daily actions to your long-term visions. It is built around four key time horizons – Intentions (daily goals), Focus (weekly goals), Milestones (monthly goals), and Visions (yearly goals) – plus an integrated calendar for events. The system ensures that each day’s tasks contribute to larger weekly, monthly, and yearly objectives ￼. By aligning everyday intentions with big-picture visions, users gain clarity on priorities and stay on track toward their most important goals ￼. This document outlines all major pages, features, modals, and questionnaires for realizing Garden Horizon to its full potential.

Core Concepts: Time Horizons and Goal Hierarchy

Garden Horizon’s philosophy is to break down large goals into smaller actionable steps across time horizons. All goal entries are linked in a hierarchy, providing continuity from vision to daily action:
• Vision (Yearly Goal): A high-level objective or “big goal” you aim to achieve in about a year. Visions form the top of the hierarchy.
• Milestone (Monthly Goal): A significant step or sub-goal typically achieved in a month or a few months, which contributes to a vision. Every vision can be divided into multiple milestones.
• Focus (Weekly Goal): A weekly target or project that helps accomplish a milestone. Milestones are broken down into weekly focuses to concentrate effort each week.
• Intention (Daily Goal): A specific action or task for the day that advances a weekly focus. These are the daily intentions you set and complete.
• Event (Calendar Event): Time-bound commitments (appointments, meetings, holidays, etc.) that are not goal-oriented tasks but affect your schedule. Events don’t directly roll up into the goal hierarchy, but they appear alongside intentions to account for your time.

Hierarchical Relationship: Visions are the “parents” of milestones; milestones are comprised of weekly focuses; focuses are achieved via daily intentions. This chain creates explicit links between each level. For example, if your yearly Vision is “Become fluent in Spanish,” a Milestone could be “Complete an intermediate Spanish course by June.” A weekly Focus under that might be “Finish Chapter 1 of Spanish textbook this week,” and daily Intentions would be the study sessions or exercises for that week (e.g. “Study vocabulary on Monday,” “Attend Spanish class on Tuesday,” etc.). In this way, a single overarching goal flows through multiple time scopes, with the same theme present at each level in progressively smaller chunks. The user can thus pursue a goal like “Learn Spanish” at all horizons simultaneously – planning the year, month, week, and day in harmony.

Time Scope Assignment: Each goal type is conceptually tied to a typical time scope (daily, weekly, monthly, yearly), but this is mostly handled behind the scenes in the database. The app will automatically treat an “Intention” as a daily item, a “Focus” as a weekly item, and so on. Users do not need to manually assign time frames – they naturally work with each item in its intended context. (For instance, when you create a Focus, it is understood to span about a week, unless specified otherwise.) This provides consistency without burdening the user with technical details.

Enforcing Alignment: Because goals are linked hierarchically, Garden Horizon can guide users to maintain alignment between their daily actions and long-term visions. If a user adds a task that doesn’t fit any current Focus or vision, the system will gently prompt them to clarify its role. For example, if you create a new daily intention “Practice French for 30 minutes” but you have no broader goal about learning French, the app might ask: “Is this task part of a larger goal or vision (e.g. becoming fluent in French)? If not, consider where it fits into your plans.” This nudge encourages reflecting on whether the task is worth the time if it’s outside any vision, or invites you to promote it to a new Focus/Milestone/Vision if it truly matters. Similarly, if a weekly Focus has no daily Intentions planned, the app can flag that gap – e.g. “Your focus ‘Apply to jobs’ has no tasks scheduled this week. Add some daily intentions to make progress on this focus.” These alignment checks help ensure that each level of the hierarchy is supported by the level below it (no weekly goal goes untouched, no monthly milestone is forgotten).

By structuring goals in this way, Garden Horizon provides a strong sense of continuity: checking off a daily task doesn’t just complete an isolated to-do, it visibly contributes to your weekly target, which in turn advances a monthly milestone, feeding into your yearly vision ￼. This clear linkage makes it easy to see why each day’s work matters in the big picture, a feature that users find highly valuable for staying motivated and organized ￼.

Dashboard and Navigation

Garden Horizon will have a user-friendly interface with logical sections for each planning horizon, plus a central dashboard for an overview. The navigation structure allows users to easily jump between big-picture planning and day-to-day execution:
• Main Dashboard: A homepage that gives a snapshot of your goals and schedule. This page highlights what’s happening today and this week, and how it ties into larger goals. For example, the dashboard might show today’s date with a brief agenda (number of tasks and events for today), the current week’s Focus, progress toward the month’s Milestone, and a reminder of your yearly Vision. It’s essentially a summary that answers: “What am I doing now, and why?” Each item on the dashboard links to its detailed page (e.g. tapping the Vision summary jumps to the Vision page). It may also surface any alerts or prompts (e.g. an alert if a milestone has no focus planned or an upcoming event that might affect your plans).
• Navigation Menu: Users can navigate to dedicated sections for Yearly Visions, Monthly Milestones, Weekly Focus, Daily Planner, and Calendar/Events. On a desktop web app, this could be a sidebar or top menu with these sections. On mobile, a tab bar or menu could provide access. The structure is intuitive: it mirrors the hierarchy from highest (Yearly) to lowest (Daily), plus a calendar section for scheduling.
• Integrated Timeline View: In addition to separate pages, the app can offer an integrated scrolling timeline that visually maps out goals and events over time. For example, a horizontal timeline could show the year broken into months and weeks; Visions and Milestones might appear as markers on this timeline, and as you scroll closer to the current week, you’d see this week’s Focus and each day’s Intentions and Events. Events (like appointments) would be displayed on their dates, providing context for available time. This “Garden Horizon scroll view” gives a continuous sense of time: you can literally scroll from the big horizon down to today. All goals and events are layered in one chronological view, helping users visualize how everything connects. (For instance, you might scroll through next month and see that a vacation event overlaps with a planned milestone, prompting you to adjust plans.) Even if the timeline view is complex to implement initially, the primary design still ensures that wherever you plan (year, month, week, or day), you always see relevant context from other levels – especially seeing fixed events alongside goals so you plan realistically.

Each of the following sections describes the specific page or view for each component of the system, along with its features, modals for creating/editing items, and any questionnaires or guidance relevant to that level.

Yearly Vision Planning

The Visions page is where users define and review their big annual goals. It provides a high-level strategic view of what the user ultimately wants to achieve within the year (or a similar long-term period). Key elements of this page include:
• List of Visions: Display all active yearly goals the user has set. Each Vision is typically shown as a card or list item with its title and perhaps a short tagline or description. If a vision has a specific target deadline (e.g. end of year or a specific date), that can be indicated as well. Users might have multiple visions (personal, professional, etc.), so this list gives an overview of all major objectives.
• Vision Details and Progress: Each Vision entry can show summary info at a glance, such as how many milestones are completed or upcoming. For example, a vision card could say “Get a New Job in 2026 – 2 of 5 milestones completed”. This lets users see progress on each big goal. A progress bar or percentage could visually represent how far along the user is (perhaps based on milestones done or overall subjective completion).
• Color or Icon Coding: To differentiate visions, the user might be able to assign a color or icon to each vision (e.g., a graduation cap icon for an education-related vision, or green color for a health-related vision). This color coding would carry through the app (so all tasks related to that vision can be marked with that color for easy identification). This feature is optional but adds a visual cue tying daily tasks back to the vision.
• Add New Vision (Modal): A prominent button (e.g. “Add Vision” or “+ New Vision”) opens a modal dialog or form to create a new yearly goal. In the Add Vision modal, the user can input:
• Title: A short name for the vision (e.g. “Become a Certified Data Analyst”).
• Description or Why: (Optional) a longer description or the “why” behind the goal. This field helps users clarify their intention – for example, “I want to switch careers to data science, so I plan to earn a Data Analyst certification by year’s end.”
• Timeframe/Deadline: (Optional) By default, a Vision could be assumed to target completion by the end of the current year. However, if the user has a different timeline (say 6 months, or a two-year goal), they can set a target date or year. This helps in planning milestones (e.g. a vision finishing in December 2026).
• Category: (Optional) Perhaps categorize the vision (Career, Health, Personal, etc.) if users want to group goals by life area. (This can be used for filtering or just personal reference.)
• Color/Icon: (Optional) Choose a color or icon as mentioned above for identification (if this feature is included).
• Submit: Saving the vision adds it to the Visions list.
• Edit Vision (Modal): Each vision item will have an edit option (e.g., clicking an “Edit” pencil icon or opening the vision’s detail then editing). The Edit Vision modal uses the same form fields as creation, allowing changes to title, description, deadline, etc. Here a user could also Archive or Delete the vision – archiving might move it to an “Archived/Completed Visions” list (so you can look back at past achieved goals), whereas deleting would remove it entirely. Deletion should probably prompt a confirmation, especially if there are milestones and other sub-goals attached (perhaps with a warning like “Deleting this vision will also delete all its milestones, focuses, and intentions. Are you sure?”).
• Vision Detail View: Clicking on a vision might navigate to a dedicated Vision detail page (or expand a section in the same page) that provides a deep dive into that specific goal. In the detail view:
• You’d see the Vision title, description, target date prominently.
• Milestone list: All Milestones associated with this vision are listed here (with their status – completed or not, and maybe due dates). This shows how the vision is broken down. For example, under “Become a Certified Data Analyst,” you might see milestones like “Complete Data Analysis Course (due May)”, “Finish 3 Portfolio Projects (due August)”, “Pass Certification Exam (due November)”.
• For quick planning, an “Add Milestone” button might be available in the vision detail, so the user can add a new milestone directly under this vision (opening the Milestone modal pre-filled with this vision as parent).
• Possibly, if the user hasn’t created any milestone for a vision yet, the detail view can gently prompt them: “No milestones yet. Add a milestone to break your vision into manageable steps.” (This aligns with guiding users to break big goals down.)
• Vision progress: Could show aggregate progress (e.g., 0%, 25%, 50% done based on sub-goals completed). If using the garden metaphor, perhaps a small image of a plant growing or a tree icon that “grows” as you achieve milestones could be shown here for a bit of fun motivation.
• Actions: Mark Vision as achieved – if the user finishes a vision early (maybe all milestones done or they subjectively consider it done), they can mark it complete. This could trigger a celebratory animation (like confetti or a congratulatory message) and move the vision to an achieved list with a completion date. This is satisfying and encourages the user to set a new vision for the next period.

Overall, the Yearly Vision Planning page is strategic. It’s not visited every day, but users might return to it periodically (monthly or quarterly) to ensure they’re on course or to adjust big goals. The interface should be clean and inspiring, reminding users of their “North Star” goals without overwhelming detail. The focus is on clarity of purpose: at a glance, the user sees “These are the big things I’m working toward this year.”

Monthly Milestones Planning

The Milestones page deals with mid-range goals – the major steps usually taking a few weeks or months that lead toward the visions. This page helps users bridge the gap between lofty visions and actionable weekly plans. Key features of the Milestones section include:
• Milestone List/Overview: This can be presented as a list of all milestones, possibly grouped by their parent Vision for context. For example, the page might be divided into sections, each labeled with a Vision name, and under each, the milestones belonging to that vision are listed. If preferred, users could switch to a timeline/calendar view of milestones by month (e.g., a year timeline with markers for each milestone in the month they’re due) – but a simple grouped list might be more straightforward initially.
• Each milestone entry shows its title, an optional short description, and a target date or deadline (if set). It also can show a status or progress indicator (e.g., “in progress” or “completed”). If a milestone has multiple focuses under it, a progress bar could indicate how many of those focuses are done.
• Example: Under the vision “Become a Certified Data Analyst,” you might see:
• Milestone: “Complete Data Analysis Course” – Due May 30, 2026 – (75% complete, 3 of 4 weekly focuses done)
• Milestone: “Finish Portfolio Projects” – Due Aug 31, 2026 – (Not started)
• Milestone: “Pass Certification Exam” – Due Nov 15, 2026 – (Not started)
And under another vision “Run a Marathon”:
• Milestone: “Half Marathon Prep” – Due June 2026 – (Completed)
• Milestone: “20-mile Practice Run” – Due Sep 2026 – (In progress)
• Add New Milestone (Modal): An “Add Milestone” button opens a modal to create a new milestone. In the Add Milestone form, the user can enter:
• Title: Name of the milestone (e.g. “Complete Data Analysis Course”).
• Description: (Optional) Details about this milestone or criteria for completion (e.g. “Finish all 12 modules of the online course and earn the certificate”).
• Target Date: When do you aim to complete this milestone? Typically a specific date or at least a month. This could be a date picker or “Month/Year” picker. It helps to schedule and track progress (and perhaps trigger reminders as the date approaches).
• Link to Vision: Select which Vision this milestone supports. This could be a dropdown of existing visions. If the user initiated adding a milestone from a Vision detail page, this field can be pre-selected to that vision. (If a user truly doesn’t want to link it to any vision, perhaps allow “None/Independent” – but we will encourage linking. An independent milestone might be treated as a standalone medium-term goal that isn’t under a yearly vision, but those should be rare if following the system.)
• Submit: Saves the milestone to the list. After creation, the user should see it under the chosen vision in the list. Possibly the app can prompt “Add some weekly Focus goals for this milestone next?” as a follow-up action.
• Edit Milestone (Modal): Users can edit a milestone via an Edit option. The Edit Milestone modal allows changing the title, description, target date, or parent Vision. If a milestone is completed or no longer relevant, the user can mark it Completed or Delete it here:
• Marking as Completed will mark all its associated weekly focuses as completed (or prompt the user to confirm completion of any incomplete sub-tasks) and update progress on the parent vision. Completed milestones might be shown with a checkmark or moved to a separate “completed milestones” list (perhaps collapsible under each vision or in an archive area).
• Deleting a milestone prompts confirmation, especially if there are Focus items under it: “Delete this milestone and all its associated weekly goals? This action cannot be undone.” Typically, deletion should be used if it was a mistake; if the milestone was attempted but not completed, one might mark it incomplete or reschedule instead.
• Milestone Detail View: Clicking a milestone could bring up a detail view (or expand a section inline) showing more information and its relationship to other goals:
• The detail would show the Milestone title, description, and target date prominently.
• Parent Vision: Indicate which vision it belongs to (with maybe a link back to that Vision’s page for context).
• Child Focus items: List all weekly Focus goals under this milestone. For example, under “Complete Data Analysis Course” milestone, the detail might list “Week 1: Finish Module 1”, “Week 2: Finish Module 2”, etc., if those focuses have been created. Each focus could show its status (done or not) and maybe the week it’s scheduled for or was completed.
• This view can help the user ensure they have a full plan: e.g., if a milestone has no focuses listed yet, a prompt could say “No weekly goals added for this milestone. Add a weekly focus to start making progress.” and an Add Focus button.
• The user can add a new focus from here which opens the focus creation modal (with the parent milestone pre-selected).
• Milestone progress: a progress bar or percentage based on the completion of its Focus items. Alternatively, the user can manually check off a milestone as done when they subjectively feel it’s achieved (perhaps if it wasn’t tied to quantifiable sub-tasks).
• Possibly allow adding notes or reflections in the milestone detail (e.g., “Notes: encountered some delays due to work in March.”). This might help when reviewing progress later or doing a monthly review.
• Milestone Calendar View (optional): For a more visual planning, we could provide a calendar or timeline specifically for milestones. For instance, a Yearly calendar where each milestone’s due date is marked on the calendar, or a Gantt-style timeline where milestones are bars spanning their expected duration. However, since milestones are typically singular achievements by a date, a simple marker on a calendar might suffice. This helps users see if multiple milestones overlap in time and ensure they are spaced reasonably. (E.g., if two big milestones are both set for December, the user might realize that’s too much at once). This view could be toggled on the Milestones page (List view vs Timeline view).

In summary, the Monthly Milestones planning ensures each vision has a concrete roadmap. It’s a place to plan “What major outcomes do I need in the next few months to reach my vision?” and to check that you’re pacing those outcomes throughout the year. By reviewing this page, users can balance their efforts across different visions and make sure no vision is neglected for too long (since each should have at least one upcoming milestone). It’s a mid-level management tool: more granular than visions, but higher-level than weekly to-dos.

Weekly Focus Planning

Weekly Focus is about deciding “What am I concentrating on this week?” It’s the tactical level where you turn milestones into week-by-week plans. The Weekly Focus page helps users define and track these short-term goals that ladder up to milestones. Key components and features are:
• Weekly Focus List/Board: The interface can be a list of focus items, possibly organized by week or by milestone. There are a couple of design approaches:
• By Time (Week View): Show a view per week, especially focusing on the current week. For example, at the top it might say “Week of March 10–16, 2026” with the focus goals planned for that week listed. There could be navigation to view previous or upcoming weeks. In this design, the user essentially schedules which focus goal is active in which week.
• The current week’s Focus items are most important – likely highlighted at the top of the page or even on the Dashboard. Many users may only pursue 1–3 major focus goals in a given week (to maintain focus), so this area might deliberately encourage a short list for the week. If multiple focuses are listed for the week, they could be prioritized or categorized (like Work, Personal, etc.).
• Upcoming weeks could be shown below or accessible via a small calendar or drop-down, allowing the user to plan future focuses (for example, “Next week: Focus will be Finish Project X”).
• By Goal (Milestone grouping): Alternatively, list all Focus items grouped under their parent milestone (similar to how milestones are grouped by vision). This is more of a backlog view of all focus goals defined, regardless of when they will be tackled. In this view, each focus still might have an “assigned week” or status. For instance, under the milestone “Complete Data Analysis Course” you might have focus items like “Finish Module 1 (scheduled: Week of Mar 3)”, “Finish Module 2 (scheduled: Week of Mar 10)”, etc. This method emphasizes the relationship to milestones and lets the user drag-and-drop or assign those focus items to specific weeks.
• We could even combine these approaches: e.g., a Kanban-style board where columns are weeks (or a timeline of weeks) and cards are focus items (with labels indicating their milestone/vision). The user can drag focus cards onto the week they plan to work on them. This visual scheduling makes it clear how you’re distributing work over time. For initial simplicity, though, a straightforward list for the current week and maybe the next week might be easier to implement.
• Current Week’s Focus: At minimum, the page (or the main dashboard) will highlight This Week’s Focus. For example: “This Week’s Focus: Apply to 5 Jobs (Career Vision)” and perhaps “Secondary Focus: Finish Marketing Project report (Work Vision)”. Each focus item named should ideally mention or be color-coded by the vision/milestone it supports, so the user knows why it’s important. If the current week has no focus set yet, the app should prompt: “What is your main focus for this week? Set a weekly goal to drive your progress.” Users can then add one.
• Add New Focus (Modal): To create a new weekly goal, the user clicks “Add Focus” (maybe available on the Weekly page or via an empty-state prompt). The Add Focus modal will include:
• Title: A short description of the weekly goal (e.g., “Apply to 5 job postings” or “Complete Module 3 of course”).
• Description: (Optional) more details or specific criteria (e.g., list of companies to apply to, or resources to use).
• Link to Milestone: Choose which milestone this weekly focus contributes to. A dropdown of milestones (perhaps showing the parent vision as well for clarity). If initiated from a Milestone detail, it can be pre-filled.
• Scheduled Week: (Optional) assign a time frame to this focus. By default, if you’re adding it during the current week, it might assume “this week.” But the user could specify a future week or a date range (e.g., “Week of Apr 7–13, 2026” if they plan it later). If the focus will span multiple weeks (e.g., a two-week goal), the user could either create it as separate focus items for each week or we allow selecting a multi-week span. To keep things simple, it might be better to treat one focus item as roughly one week’s worth of goal; if it actually needs two weeks, the user can mark it as continuing next week or split it.
• Priority or Order: (Optional) if multiple focuses in one week, maybe let user set which is primary vs secondary. Or this can be inferred by order in the list.
• Submit: Saves the focus. If it’s scheduled for the current week (or no specific week, meaning immediate), it will show up under “This Week”. If scheduled for a future week, the user might not see it until that week (unless viewing the future plan). (We might have a section like “Upcoming Focus” listing future-scheduled items.)
• Edit Focus (Modal): Allows modifying the focus goal. Fields similar to add (title, description, linked milestone, scheduled week). The user can update its status here too:
• Mark as Completed if finished early. Marking it done could either be automatic once all its daily tasks are done, or manually by the user at week’s end. When marked complete, its parent milestone’s progress updates.
• If a focus is not completed by the end of the week, the user can choose to roll it over to the next week (this might be an action like “Carry over to next week”), which simply updates its scheduled week to the next one and perhaps logs that it was extended. The app might prompt this in the weekly review (e.g., “You did not finish focus X this week. Do you want to continue it next week?”).
• Delete Focus if it’s not needed (confirmation required, especially if there are tasks linked to it – those tasks could either become unlinked or should probably be deleted too or re-assigned).
• Weekly Review & Plan Prompt: At the end or start of each week, the app can engage the user with a quick weekly check-in modal (more on questionnaires in a later section, but mentioning here): It would list last week’s focus and ask if it was accomplished, then prompt to set or confirm the focus for the new week. For example, Monday morning, a pop-up might say: “Last week your focus was ‘Finish Module 3’. You marked it incomplete. Would you like to continue this as this week’s focus or set a new focus?” Then allow quickly choosing/carrying over. This ensures the user always has at least one clear focus each week.
• Focus Detail View: Clicking on a Focus could show more information about that weekly goal:
• State the goal, any details, and the associated milestone/vision (e.g., “Part of: Complete Data Analysis Course (Milestone) -> Become Data Analyst (Vision)”).
• List the daily Intentions associated with this focus (either planned or completed). For instance, under the focus “Apply to 5 jobs this week,” the detail might show intentions like “Monday – Update resume”, “Tuesday – Find 5 job postings”, “Wednesday – Submit 2 applications”, etc., giving a breakdown of how the weekly goal is being pursued each day.
• If some days have no intentions for that focus yet, perhaps show blank placeholders or suggestions to add (like “No tasks planned for Thursday for this focus – consider adding one”). This ties in with alignment checks.
• The focus detail might also show a mini-calendar of the week highlighting which days had tasks for this focus, which can reveal patterns (maybe via icons on a tiny weekly calendar diagram).
• Could allow adding a new intention for that focus right from this detail (like a quick-add that defaults to that focus and today’s date or a chosen date).

The Weekly Focus planning is crucial for translating monthly goals into actionable steps. It’s the level at which the user makes decisions like “This week I will concentrate on X.” By maintaining this focus list, the app helps users avoid feeling overwhelmed by the entire milestone at once; instead they tackle one chunk at a time. It also creates accountability – when the week is over, they can reflect whether the focus was achieved, and if not, adjust. The design should make it very easy to set a focus and see it often (perhaps it’s shown on the daily page as a reminder as well). Keeping the weekly focus front-and-center ensures each week has a purpose that feeds the larger goals.

Daily Intentions & Scheduling

The Daily Planner is where users translate their weekly focus into concrete actions and manage their day-to-day schedule. It combines a task list with a calendar view of the day’s events, enabling realistic planning. The Daily Intentions page (Today’s view) is likely the most frequently used part of Garden Horizon, so it should be intuitive and encouraging. Its main features include:
• Daily Agenda Overview: At the top of the daily page, display the date (e.g. “Tuesday, March 11, 2026”) and a quick summary of the day. This could include the name of the current week’s focus goal for context (e.g., a line like “Weekly Focus: Apply to 5 Jobs” as a reminder of the overarching goal while planning the day). If the user has set an intention as their main goal for today (like a highlight), that could be shown too (some users pick one “intention” or priority each day).
• Timeline Schedule (Day Planner): The core of the daily page is a visual scheduler for the day’s hours, integrating both Intentions (tasks) and Events:
• The timeline is typically a vertical hourly schedule (e.g., 6:00 AM to 10:00 PM) or any range the user prefers. It shows time slots and any fixed events (from the calendar) blocked out in their respective times.
• Events (such as meetings, work hours, appointments) appear as colored blocks spanning their time (likely in a distinct color, e.g., gray or blue) – these are read-only from this view (though clicking could edit the event).
• Intentions (tasks) can be scheduled into the free spaces on the timeline. Each intention is represented as a block or bar that can be dragged/resized in the schedule. For example, if you plan to work on a job application at 7:00 PM for 1 hour, you’d create an intention block there labeled “Apply to Company X”.
• Unscheduled tasks for the day (if any) might sit in a list above or below the timeline (“Unscheduled tasks” section) so the user remembers to assign them a time or at least address them at some point.
• Users can drag tasks from the unscheduled list onto the timeline at a desired time, or create them directly on the timeline by clicking an empty slot (similar to how one would add a calendar event).
• The timeline ensures realism in planning – if you have an event from 9-11 AM, you won’t double-book a task at 9 AM. It forces you to acknowledge time constraints. The presence of events in the same view “grounds” the user, as you described, so they can balance ambition with practicality (e.g., noticing that after work and gym, there are only 2 hours left in the evening to study Spanish).
• Task List Mode: Some users might prefer a simple checklist view instead of a calendar timeline. We could offer a toggle or combined view: for instance, the left side shows the timeline, and the right side could show a checklist of today’s intentions with times (or unscheduled tasks). Alternatively, a toggle to switch between “Schedule view” and “List view” could be provided. In list view, tasks could still have times indicated but primarily it’s for quick checking off without the visual calendar. (This is optional, but might improve usability for those who find dragging on a timeline tedious.)
• Adding a Daily Intention (Task): There are multiple ways to add a new intention for today (or any specific date):
• Quick Add via Text Field: Perhaps a text box at the top of the list: e.g., “Add an intention…” where typing “Buy groceries @5pm” could create a task “Buy groceries” at 5:00 PM. Natural language parsing could be a nice touch (not mandatory for initial version, but something like times or tomorrow/tonight could be parsed).
• Timeline Click: Clicking or dragging on a time slot in the schedule could open a small New Task modal/popover with details pre-filled for that time.
• Add Button: A floating “+” button that opens a more detailed Add Intention modal. In the Add Intention form, the user can set:
• Title: What to do (e.g., “Write cover letter for Company X”).
• Description/Notes: (Optional) additional info or sub-steps.
• Date: Default is today (if on today’s page). The user can choose another date if they’re planning ahead.
• Time & Duration: Option to set a specific start time and end time/duration for the task. For example, start at 7:00 PM, duration 1 hour (the UI might allow picking start and end or start+duration). If the user leaves this blank, the task will be an “unscheduled” item for that day.
• Link to Focus: A dropdown or tags to associate this task with a weekly Focus (and thus a milestone/vision). This list would show the focuses that are currently active (e.g., this week’s focus, or any other active short-term goals) – and possibly an option for “None”. If the user selects a focus (say “Apply to 5 Jobs”), the task inherits that context. If “None” is selected, the app might later prompt if this should be linked, but it will allow it.
• Repeat: (Optional) If this is something that should repeat multiple days (though usually repeated things might be events or habits, but sometimes tasks repeat weekly, etc.). We may allow setting a recurrence for an intention (like “every Monday” or “daily for 1 week”), but recurring tasks blur the line with events. Perhaps better to keep recurring strictly for events and treat intentions as one-offs or use templates for repetition. This can be revisited, but to keep daily planning straightforward, assume no recurring tasks (aside from adding from templates each day).
• Save: The new intention appears on the timeline (if time set) or in the unscheduled list for that day. If it’s for a future date, it will show up when that date arrives (and maybe in an Upcoming list if we provide one).
• Common Intention Templates (Presets): (“Common intentions” feature)
On the daily planner, there is a side panel or menu for frequently used tasks. Many people have daily habits or repeated to-dos (like “Exercise for 30 min”, “Meditate”, “Plan tomorrow”, etc.). Garden Horizon provides Common Intentions as editable templates to make adding these easier:
• A sidebar titled “Common Intentions” could list items like “🧘‍♀️ Meditate (15m)”, “🏃‍♂️ Exercise (30m)”, “📖 Read (30m)”, etc., which come pre-loaded or are created by the user.
• The user can drag and drop a common intention from this list onto today’s schedule. When dropped, it creates a new task instance. For example, dragging “Exercise (30m)” onto 6:30 AM will schedule a 30-minute Exercise task at that time.
• These templates are fully editable by the user. There might be a “Manage Templates” button or simply allow inline editing of the template list. Users can add new templates (with default duration, maybe default focus link or note if applicable), delete ones they don’t use, or modify them (e.g., change “Exercise” to default 1 hour instead of 30m).
• Common Intentions streamline the planning of routine or habitual tasks – instead of re-typing every day, the user can quickly populate their day with these typical activities. Over time, this could also serve as a habit tracker if users see how often they drag in a particular intention.
• Because these are meant to be used daily, the common intentions panel will be accessible on each day’s view (likely collapsed or via a button on mobile to not take too much screen space, but easily accessible).
• Example: A user who values health might have a common intention “Drink 8 glasses of water” or “Morning Run”. Each morning they can drag “Morning Run” into their 7 AM slot. If they skip it, that’s noticeable and they may reflect on it later.
• Completing and Checking Off Tasks: As the day goes on, the user will tick off intentions as they complete them:
• Each intention in the list or timeline can have a checkbox or a way to mark done. For instance, on the timeline block, tapping it could toggle a “done” state (perhaps turning the block green or with a checkmark icon). In a list, a checkbox would suffice.
• Completed tasks might remain visible (with a strikethrough or dimmed) so the user sees what’s done, or optionally could move to a “Completed” section below to declutter the schedule. We can let the user choose a setting (some like to hide done tasks).
• When a task is marked complete, if it’s linked to a Focus, the progress for that focus updates. Possibly, a subtle animation could reinforce that (like filling a progress circle next to the weekly focus goal).
• If the user tries to mark an event as “done”, that doesn’t apply – events are not tasks to complete (though maybe attending an event could be considered done once the time passes, but we don’t need to mark it, it’s just past).
• Daily review prompt: At the end of the day (or the next morning), the app might ask “Did you complete all your intentions for today?” If not, it could offer to roll over unfinished tasks to tomorrow or cancel them. For example, if “Finish reading Chapter 3” was not done, user can choose to reschedule it for the next day or later. This prevents tasks from just vanishing or being forgotten if not done on the scheduled day.
• Navigating Days: The daily view should allow moving to past or future dates. Simple arrow buttons or a date picker can let the user check yesterday or plan for tomorrow and beyond. For example, on Sunday night, you might go to Monday and plan out some tasks in advance. Or you might review yesterday to see what was done or not done (this ties into the reflection aspect).
• The UI should clearly distinguish past days from today/future (past days might show the completed tasks, future days are just plans). Possibly, past days are read-only (no editing tasks in the past, except maybe adding notes or marking something done late).
• The current day “Today” is usually highlighted or easily accessible via a Today button.

The Daily Intentions & Scheduling page is where everything comes together: the user allocates time for tasks that serve their focus, while juggling real-world constraints (events and time available). It encourages good habits like daily planning and time-blocking. By seeing their weekly goal reminder and using templates, users can form routines that support their goals. This page should feel motivating – e.g., maybe greet the user (“Good Morning! Ready to tackle your intentions for today?”), and satisfying to use (ticking off tasks gives a sense of accomplishment). It’s essentially the user’s personal daily planner, but intelligently connected to their broader objectives.

Calendar Events Integration

To make goal planning realistic, Garden Horizon integrates a calendar for events. Events represent fixed time commitments that are not part of the goal hierarchy but must be accounted for when planning tasks. Key features for events and calendar integration include:
• Unified View with Tasks: As described in the daily planner, events appear on the same timeline as intentions. This means the user doesn’t need to check a separate calendar app to remember appointments – everything is in one place. For example, if you have a “Work 9am-5pm” event every weekday, it will appear as a blocked chunk on each day, signaling that those hours are occupied (and you shouldn’t schedule goal tasks during them). By overlaying events and tasks, the app helps users realistically plan what can be done in a day or week.
• Event Creation (Modal): Users can add events directly in Garden Horizon. Perhaps there’s an “Add Event” button on the daily view or a dedicated Calendar page. The Add Event form would include:
• Title: Name of the event (e.g., “Doctor Appointment” or “Team Meeting”).
• Date: The day of the event. (If initiated from a specific day’s view, it pre-fills that date.)
• Start Time and End Time: When the event begins and ends. Option for all-day events (like a holiday) – if all-day, it might show at top of that day or as a banner.
• Location: (Optional) e.g., “Downtown Clinic” or a video-call link if relevant.
• Repeat/Recurrence: If the event repeats, the user can set a recurrence rule (daily, weekly on certain days, monthly, etc., similar to typical calendar apps). For instance, “Every Monday and Wednesday at 6:00 PM” for a yoga class, or “Repeat every day until Aug 30” for a vacation.
• Reminder/Notification: (Optional) set an alert X minutes before. (Notifications will be handled globally, but a user might want an alert for an event like any calendar).
• Description/Notes: (Optional) any extra info (agenda of a meeting, etc.).
• Save: The event is added to the calendar and will appear on the respective dates in the timeline. If recurring, all future instances are generated accordingly.
• Edit Event: Clicking an event on the timeline can open its details or edit modal. Users can change details or update the recurrence (with typical options to edit just this one or the whole series). They can also delete events (single or series). Deleting an event series might ask if all occurrences or just one should be removed.
• Calendar Page (Month/Week View): Although integration means you rarely need a separate calendar view, providing one can be useful for overview and managing events:
• A Month View Calendar could be available under an “Events” or “Calendar” section. This would look like a traditional calendar grid showing the current month with events marked on each day. It’s useful to see, for example, when you have vacations, conferences, or busy days coming up, which might impact your goals.
• The month view might also show milestones or high-level goals as dots or icons on certain dates (like milestone due dates), giving a combined picture of personal deadlines and events.
• Users can navigate months and see what events are scheduled. They can also add events from this view (e.g., click on a date to add).
• A Week view (separate from the goal-focused weekly page) could also be provided, showing a weekly calendar with hourly slots for each day (similar to Google Calendar’s week view). This would primarily be for those who like to visualize their whole week’s schedule of events and tasks together. In a week view, tasks could also be shown (if we integrate them here, essentially combining all daily timelines of that week side by side). This might be a more advanced feature, but it could reinforce how tasks (especially if scheduled) and events fill the week.
• If implementing an integrated scroll timeline (as mentioned, where you scroll through days), a separate week view might not be necessary, as the scroll could cover it. But a calendar grid is sometimes easier for date-specific awareness.
• External Calendar Sync (Future Enhancement): In the long run, integrating with external calendars (Google, Outlook, Apple) would be very helpful so users don’t have to double-enter events. In this project guide, we note it as a potential feature: e.g., the app could allow one-way or two-way sync with Google Calendar so that events from your work calendar automatically show up in Garden Horizon’s timeline. This would ensure the schedule is comprehensive. Initially, however, even manual entry or import is fine.
• Event Display & Conflicts: The app should visually differentiate events from tasks (different colors or perhaps events have rounded corners vs tasks with square, etc.). If a user attempts to schedule a new task at a time that conflicts with an event, the app can warn or prevent overlap: e.g., “You have an event at that time. Adjust the task time or duration.” We assume tasks should not overlap with events since that time is occupied. Similarly, overlapping tasks with each other might also be disallowed or warned, unless a user explicitly marks a task as something that can be parallel (unlikely, better to keep it simple: one thing at a time).
• The timeline interface can use snapping or guidelines to help place tasks right after an event ends or before one starts, optimizing use of time gaps.
• All-day and Multi-day events: These (like a vacation from Jan 5–10, or a multi-day conference) should appear as banners at the top of the day view (spanning across the days in week/month view). They effectively indicate “these days are partly/fully taken by this event.” In a daily view, an all-day event could just be noted at the top (so user knows the day is special, but still can plan other tasks if not literally busy all hours).

By tightly integrating events, Garden Horizon ensures that goal planning isn’t done in a vacuum. Life events, work commitments, and downtime are all part of the picture. This prevents overplanning (e.g., scheduling 10 hours of study on a day you also have a full-day seminar). It encourages users to find balance – they might see a week with too many events and realize they should set a lighter focus goal that week, or conversely a free weekend might be a chance to push harder on a milestone. Events essentially set the canvas on which the user paints their intentions. The app’s job is to seamlessly merge the two, so that one’s ideal plan (goals) adapts to reality (time constraints).

Alignment, Guidance, and Reflection

One of the strengths of Garden Horizon is not just planning tasks, but also guiding the user to stay aligned with their intentions and learn from their progress. This section covers features related to app intelligence: prompts, reminders, and reflective questionnaires that ensure the system is used to its full potential.
• Goal Alignment Prompts: The app monitors the linkage between different levels of goals and provides gentle feedback:
• If a Vision has gone stale (e.g., no milestone completed or scheduled in a long time), a prompt on the dashboard or vision page might say “Consider setting a milestone for Vision X to keep it moving forward.”
• If a Milestone’s target date is nearing and not enough progress has been made, an alert could warn “Milestone ‘Finish Portfolio Projects’ is due in 2 weeks, but only 1 of 3 weekly focuses are completed. Plan additional focuses or adjust the deadline.”
• If a weekly Focus is set but by mid-week there are still no daily Intentions tagged to it, the app can highlight this on the daily page or via notification: “You declared ‘Finish Module 5’ as this week’s focus, but there are no study sessions scheduled yet. Add some Intentions for the next days to ensure progress.” This kind of nudge ties back to keeping daily actions aligned.
• Conversely, if a user is spending time on tasks that are unrelated to any focus or vision (a lot of “None” category tasks), the app might prompt reflection: “You have 5 tasks this week not linked to any goal. It’s okay to handle miscellaneous stuff, but make sure to allocate time to your priority goals as well.” It could even suggest linking some tasks to goals if appropriate (e.g., a task “Buy running shoes” could be linked to a marathon training vision if that was missed).
• These prompts should be helpful, not nagging. The user could have the ability to dismiss or snooze them. The idea is to act like a gentle coach in the background.
• Notifications & Reminders: Garden Horizon can send timely notifications to keep the user engaged and on track:
• Task/Event Reminders: At a set time before an event or scheduled task, send a notification (e.g., “Upcoming: Interview at 3:00 PM” or “Time to start: Study Spanish at 7:00 PM”). This ensures plans are not forgotten in the flow of the day.
• Daily Morning Briefing: Optionally, a morning push/email that lists the day’s focus, tasks, and events (“Today: 3 intentions (Study 1h, Gym 1h, Write report 2h) and 2 events (Meeting 10am, Dentist 4pm). You have ~3 hours of free time. Let’s make it productive!”). This sets the tone for the day.
• Evening Wrap-up: A notification could ask “Did you achieve your main intention today? Mark your progress and plan for tomorrow.” This leads into the daily reflection if the user wants.
• Weekly Reminder: On a chosen day (say Sunday evening), remind the user to review the past week and set the new weekly focus. E.g., “It’s Sunday – take 5 minutes to review your week and plan your focus for next week.”
• Milestone/Vision Reminders: If a milestone deadline is near, or beginning of a new month for a new milestone, remind the user (e.g., “April is starting – time to start working on your next milestone for ‘Fitness Vision’ if you haven’t planned it yet.”). End of year could prompt thinking about new visions.
• Reflective Questionnaires (Reviews): At key intervals, the app should prompt the user with short questionnaires or check-ins to promote reflection and adjust plans:
• Daily Check-In/Out: This can be very quick. At day’s end, a pop-up might ask:
• “How was your day? Did you complete all your intentions?” (User can check yes/no; if no, perhaps list which weren’t done and offer to reschedule them).
• Possibly, “What went well today?” and “What will you improve tomorrow?” as optional short-answer questions for the user’s own benefit (journaling aspect).
• This journal data can be stored for the user to review later in some log or calendar view (but not necessarily heavily analyzed by app).
• If a daily intention was marked as a “day goal” or something particularly meaningful, the check-in can remind them of it: “You set an intention to write 500 words. Did you accomplish it?” and if yes, congratulate briefly.
• Weekly Review (Questionnaire): When a week concludes (or start of next week), a modal guides the user through a reflection:
• It will list the week’s Focus (or multiple, if any) and ask status: “Weekly Focus: Finish Module 5 – Achieved?” The user can tick achieved or not.
• “Highlights of the week?” (text field for user to note successes or happy moments).
• “Challenges or obstacles?” (text field for difficulties).
• “Lessons learned / Improvements for next week?” (text field).
• If the focus was not achieved, ask “Will you carry this focus into next week, or adjust it?” with options to carry over, choose a smaller scope, or drop it if priorities changed.
• Then prompt “Set your focus for the new week:” – either confirm the carried over one or input a new one (this could directly create a focus item for the new week).
• This review ensures continuity from week to week and that the user consciously acknowledges progress or lack thereof, rather than goals slipping by.
• Monthly Review: Similar to weekly but at a higher level:
• “Milestone: Complete Data Analysis Course – due May 30. Are you on track? (Completed this month or percentage done?)” If the milestone was targeted for the month that ended, ask if it was achieved and reflect on it.
• “What progress did you make this month towards your visions?” Possibly list each vision with its milestones status for user to consider.
• “Any adjustments to your goals for next month?” Maybe the user wants to defer a milestone or change a focus – they can note or directly edit milestones here.
• “New milestones or goals for the coming month?” Encourage planning something if appropriate.
• This could happen at end of month or beginning of new month.
• Yearly Review & New Year Planning: At year’s end:
• Celebrate achieved visions: “Congratulations! You accomplished X out of Y visions for 2026!” maybe with some fun graphics.
• For each vision, ask “Completed? If not, will you continue this into next year?” They might extend a vision or transform it.
• Reflective questions: “What were your biggest achievements? What challenges did you face? What will you aim for next year?”
• Then prompt to create new Visions for the next year (this ties into onboarding for a new cycle).
• This yearly reset is important for the longevity of the app’s use year over year.
These questionnaires not only provide closure and a sense of accomplishment, but also prompt the user to update the plan. They effectively keep the database of goals “alive” and accurate (e.g., dropping goals that are no longer relevant, adding new ones as life changes, etc.).
• Progress Tracking & Visualization: Throughout the app, giving feedback on progress motivates users:
• We discussed progress bars for visions and milestones. Similarly, we can have completion stats: e.g., on the dashboard, show “This week: 5/7 intentions completed” or a percentage of tasks done, or “You have a 3-day streak of completing all your intentions!” (if they did so, highlighting consistency).
• The Garden Metaphor for Motivation: Staying true to the name “Garden Horizon,” one idea is to represent each vision as a plant in a virtual garden. As the user completes tasks and milestones, the plant grows. For example, when a milestone is completed, a new flower blooms on that plant; when the vision is achieved, the plant might fully bloom or bear fruit. The daily intentions could be seen as “watering” the plants. This provides a visual, gamified sense of growth. A separate Garden view could show all your vision-plants in one screen – some might be seedlings (new goals), others blossoming (progressing well), maybe some wilting if neglected (no progress – as a gentle metaphorical warning). This view would be a fun, less quantitative way to see how you’re tending to your goals. It can be purely illustrative (no need for complex mechanics, just update visuals based on progress percentages).
• Achievements/Badges: Another motivational feature could be awarding badges or streaks for certain accomplishments. For example, “Completed all planned tasks for 7 days in a row – Productivity Champ!” or “Achieved 5 weekly focuses in a row – On a Roll!” These appear in the user’s profile or dashboard. They add a gamification element that might encourage consistency.
• Analytics: Provide some stats like average tasks completed per day, or time spent on each vision (if we track duration of tasks, we could sum how many hours were invested per vision). In a review screen, showing “You spent 40 hours on Career goals and 10 hours on Health goals this month” might be insightful (though tracking time precisely may rely on them scheduling tasks and marking done – an approximation).
• These should be presented in a user-friendly way, maybe charts or just simple figures on the dashboard or in review reports. The idea is to give feedback that helps users self-manage (e.g., “Wow, I spent so little time on health, I should focus more there next month.”).
• Adaptability and Flexibility: Life is unpredictable, and the system should accommodate change:
• Allow users to reschedule tasks easily (drag and drop to another day, or an option “move to tomorrow”).
• Allow editing goals if priorities shift (maybe a vision is no longer relevant; user can cancel it or replace it).
• Encourage users to not abandon the system if they fall behind – the tone of prompts should be encouraging and never shaming. For example, if many tasks were left incomplete, say “It’s okay, last week was tough. Let’s adjust your plan for next week to be more achievable.” This keeps the user engaged rather than feeling guilt and quitting.
• The app could even detect patterns and suggest improvements: e.g., “You consistently plan more tasks than you complete on weekdays. Consider scheduling fewer intentions or shorter durations to better match your capacity.” This kind of insight can help users plan better (this is a more advanced feature involving analytics on planned vs completed tasks).
• Privacy and Personalization: Since the app might contain personal reflections and data, reassure in the design that these journals (like the answers to weekly review questions) are private to the user. Also, adapt to user’s style: some might skip the questionnaires, so the app could allow turning off certain prompts if they find them annoying, or set the frequency (maybe a user only wants monthly reviews, not weekly – we can make weekly optional).

In essence, the Alignment, Guidance, and Reflection features turn Garden Horizon from a static planning tool into a dynamic personal coach. By continuously checking alignment between daily actions and yearly goals, providing feedback and requiring the user to pause and reflect, the app helps users build better habits and maintain focus on what matters. Over time, these features teach the user how to plan more effectively and use their time in accordance with their values and visions.

Conclusion and Next Steps

This project plan outlines a full-featured vision for Garden Horizon, covering everything from defining long-term visions to executing daily tasks. To summarize the key pages and flows:
• Onboarding: Guide the new user to add initial Visions, maybe one milestone per vision, and set their first week’s focus and today’s intention, so they grasp the whole chain from the start.
• Visions Page: Where yearly goals live; add/edit visions and view milestone breakdowns.
• Milestones Page: Plan the major monthly steps; link to visions and spawn weekly focuses.
• Weekly Focus Page: Decide what to tackle each week; link to milestones; review at week’s end.
• Daily Planner Page: Schedule today’s tasks around events; drag in common intentions; check off done tasks.
• Calendar Integration: Keep track of events and free time; avoid scheduling conflicts; see big picture dates.
• Common Intentions Library: Quickly reuse frequent tasks; editable templates make daily planning faster.
• Guidance System: Smart prompts to align tasks to goals; regular check-in questionnaires (daily/weekly/monthly/yearly) to reflect and adjust; progress visualization (bars, stats, or even a metaphorical garden).
• Modals & Forms: Consistent create/edit dialogs for each item type (visions, milestones, focuses, intentions, events) to input details easily.
• Notifications: Timely reminders for tasks and reviews to keep engagement.
• Data management: Under the hood, maintain links between all items (so the app always knows, e.g., which vision a task ultimately serves). This ensures that when things update, progress can roll up automatically.

In building Garden Horizon, it will be important to iterate and get user feedback. The full scope described here is ambitious – it’s the “full potential” vision. The development could be phased (for instance, start with core goal hierarchy and daily planning, then add reflection features and advanced analytics later). Yet, even in its initial version, the core promise should shine: helping users see the forest and the trees at the same time – the garden of their long-term visions and the daily steps on the horizon in front of them.

By following this plan, we’ll create a tool that not only helps people organize their tasks, but truly connects their everyday efforts with their dreams and intentions. Garden Horizon will serve as a guide and companion, ensuring that no goal is too big by itself and no day’s effort is too small to matter.

# wireframes

1. Garden Horizon (Home / Arrival Page)

Primary role:
Arrival, orientation, calm reality check.
This page must work even if the user does nothing.

⸻

Layout Structure

┌──────────────────────────────────────────────┐
│ Top Utility Bar │
└──────────────────────────────────────────────┘
┌───────────────┬──────────────────────────────┐
│ Goal Spine │ Main Time Canvas │
│ (persistent) │ (vertical scroll) │
│ │ │
│ │ Year horizon │
│ │ Month horizon │
│ │ Week horizon │
│ │ NOW (default view) │
│ │ │
└───────────────┴──────────────────────────────┘
┌──────────────────────────────┐
│ Floating Utility Rail │
└──────────────────────────────┘

⸻

A. Top Utility Bar (quiet, informational)

Contents:
• Back / Garden label
• Optional time lenses (Day / Week / Month / Year)
• Scope selector
• Settings icon

Rules:
• No highlighted default
• No “Today” CTA
• Treated as filters, not modes

⸻

B. Goal Spine (left or right, always visible)

Contents:
• Vertical list of goals
• Each goal shows:
• Name
• Subtle state indicator (active / resting / dormant)
• “+ New goal” at bottom

Behavior:
• Click → Goal Detail page
• Hover / tap → Reality Preview Overlay
• Dormant goals fade slightly (no warning language)

Important:
This is memory, not a task list.

⸻

C. Main Time Canvas (core of the page)

Single vertical scroll surface.

Sections (not cards, just spatial bands):

[ THIS YEAR ] (most faded, spacious)
[ THIS MONTH ]
[ THIS WEEK ]
[ NOW ] (default scroll position)

NOW section includes:
• Day + date
• Soft greeting
• “You are here” marker

Rules:
• No boxes
• No prompts
• No required interaction

Scrolling = zooming in and out of time.

⸻

D. Gentle Status Line (static copy)

Placed near NOW, very subtle.

Example:

“Here when you need me.”

Never conditional. Never reactive.

⸻

E. Floating Utility Rail

Contents:
• Plan
• Review
• Map

Behavior:
• Opens overlays or pages
• Never suggests itself
• Always available

⸻

2. Reality Preview Overlay (Overlay, not page)

Primary role:
Kind autistic coach. Show reality, don’t judge.

⸻

How it Appears
• Triggered by:
• Hover / tap on goal in spine
• Previewing a commitment
• Appears on top of the Garden canvas

⸻

What It Looks Like (conceptually)

[ THIS WEEK ]
| ░░ Spanish ░░ 30m ░░ 30m ░░ 30m ░░ |
| ░░ Existing commitments ░░ |

    •	Semi-transparent bands
    •	Overlays current horizon
    •	Color coded lightly (goal-specific)

⸻

Behavior Rules
• No modal
• No text explanation required
• No save
• Clicking away dismisses it

Optional micro-copy (small, edge-aligned):

“This would live here.”

⸻

3. Goal Detail / Vision Page

Primary role:
Relationship with one goal. Optional depth.

⸻

Layout Structure

┌──────────────────────────────────────────────┐
│ Header (Back to Garden | Edit Goal) │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ Goal Identity Section │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ State + Context Indicators │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ Optional Structure Zone (collapsed by default)│
└──────────────────────────────────────────────┘

⸻

A. Header

Contents:
• ← Back to Garden
• Page label (Vision)
• Edit goal action

No breadcrumbs beyond Garden.

⸻

B. Goal Identity Section

Contents:
• Goal title
• Optional description (why it matters)
• Optional long-term horizon (year / season)
• Optional visual state badge (Sprouting, Resting)

Rules:
• No urgency language
• No “complete” framing required

⸻

C. State & Relationship Indicators

Examples:
• Time logged (optional)
• Status (active / resting / dormant)

Language rules:
• State, not progress
• Informational, not evaluative

⸻

D. Optional Structure Zone

Collapsed by default.

Initial copy:

“This space can hold structure if it’s helpful.”

Button:

“+ Add something”

⸻

E. Optional Modules (all opt-in)

Notes (MVP)

Notes
• freeform entries
• timestamped
• no formatting pressure

Later modules (not MVP)
• Milestones
• Habit heatmap
• Gentle schedule

All live only here, never on Garden.

⸻

4. Planning Page (Explicit, Optional)

Primary role:
Turn a goal into a commitment only when chosen.

⸻

Layout Structure

Plan for: [Goal Name]

[ Frequency ]
[ Duration ]
[ Energy Type ]
[ Horizon ]

(Preview)
(Consent)

⸻

A. Commitment Definition

Simple inputs:
• Times per week
• Minutes per session
• Energy type
• Horizon (week / month / season)

⸻

B. Reality Preview (mandatory before save)
• Triggers Reality Overlay on Garden canvas
• Shows overlap visually

⸻

C. Consent Gate (tiny pause)

Copy:

“This adds ~90 minutes per week on top of what’s already here.”

Buttons:
• Include
• Not now
• Make lighter

No “confirm” language.

⸻

5. Map Page (Later Phase)

Primary role:
Pattern recognition, not planning.

⸻

Layout
• Full canvas
• Spatial representation of time + goals
• Filters only

Rules:
• Read-only
• No editing
• No creation

⸻

Summary: What Each Page Is For

Page Job
Garden Horizon Arrive, orient, remember, feel safe
Reality Overlay Show honest cost without judgment
Goal Detail Build relationship with one goal
Planning Page Make explicit commitments
Map See patterns, not act
