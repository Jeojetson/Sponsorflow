const today = new Date();
const date = offset => { const d = new Date(today); d.setDate(d.getDate()+offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const teams = [
 {id:'TEAM-CLUB',name:'ASME Indianapolis',icon:'ASME',active:true},
 {id:'TEAM-MECH',name:'Mechanical',icon:'MECH',active:true},
 {id:'TEAM-ELEC',name:'Electrical',icon:'ELEC',active:true},
 {id:'TEAM-OPS',name:'Operations',icon:'OPS',active:true}
];
const boards = [
 {id:'BOARD-CLUB-MASTER',teamId:'TEAM-CLUB',name:'Club planning',description:'Meetings, milestones, and shared deadlines.',active:true},
 {id:'BOARD-MECH',teamId:'TEAM-MECH',name:'Chassis & running gear',description:'Design, manufacture, and test the kart chassis.',active:true},
 {id:'BOARD-ELEC',teamId:'TEAM-ELEC',name:'Electrical systems',description:'Battery, controls, and wiring for the next build.',active:true},
 {id:'BOARD-OPS',teamId:'TEAM-OPS',name:'Funding & purchasing',description:'Applications, quotes, and parts for the team.',active:true}
];
const seed = [
 ['Design battery enclosure mounts','BOARD-MECH','IN_PROGRESS','WORK',3,40,'Jordan Lee'],
 ['Confirm brake line fittings','BOARD-MECH','BLOCKED','PURCHASE',-2,10,'Casey Morgan'],
 ['Review wiring schematic','BOARD-ELEC','REVIEW','WORK',1,90,'Jordan Lee'],
 ['Weekly team meeting','BOARD-CLUB-MASTER','PLANNED','MEETING',0,0,'Casey Morgan'],
 ['Bench test motor controller','BOARD-ELEC','PLANNED','WORK',6,0,'Avery Chen'],
 ['Submit equipment grant','BOARD-OPS','IN_PROGRESS','FUNDING',7,25,'Jordan Lee'],
 ['Order connector housings','BOARD-OPS','PLANNED','PURCHASE',9,0,'Avery Chen'],
 ['Document steering geometry','BOARD-MECH','DONE','WORK',-3,100,'Casey Morgan'],
 ['Design review','BOARD-CLUB-MASTER','PLANNED','MEETING',4,0,'Jordan Lee'],
 ['Track testing','BOARD-CLUB-MASTER','PLANNED','MEETING',10,0,'Avery Chen']
];
const tasks=seed.map(([title,boardId,status,taskType,offset,progress,ownerNames],i)=>({id:`TASK-${i+1}`,title,boardId,status,taskType,progress,ownerNames,description:'Record the measurements and review them with the team.',startDate:date(offset-2),dueDate:date(offset),allDay:true,startTime:'',endTime:'',location:'Engineering lab',priority:i===1?'HIGH':'MEDIUM',tags:'design, build',isMilestone:false,importantDate:taskType==='MEETING',campus:'Indianapolis',fundingMin:1000,fundingMax:4000,fundingAmountLabel:'Up to $4,000',sourceUrl:'https://example.com/source',sourceConfidence:'TEAM_ENTERED',requirements:'Existing requirements',partName:'Retained part',partNumber:'P-123',vendor:'Team supplier',quantity:2,estimatedCost:125.50,orderStatus:taskType==='PURCHASE'?'NEEDS_QUOTE':'NOT_NEEDED',dependencyIds:i===0?['TASK-8','ARCHIVED-DEPENDENCY']:[],commentCount:i===0?2:0,updatedBy:'Jordan Lee',updatedAt:'2026-09-15T14:00:00Z',archived:false}));
tasks[5].startDate=''; // A due-date-only record must remain due-date-only.
module.exports={date,teams,boards,tasks,calendars:[{id:'CAL-RACE',name:'Race preparation',description:'Mechanical and electrical dates.',teamIds:['TEAM-MECH','TEAM-ELEC'],includeGeneral:true,importantOnly:false,color:'GOLD'}],calendarFeedBaseUrl:'https://example.com/calendar',meetings:[{id:'MEET-1',title:'Weekly team meeting',meetingDate:date(0),startTime:'18:00',endTime:'19:00',location:'Engineering lab',teamId:'TEAM-CLUB',active:true,description:'Bring your project updates.'}]};
