
// helper func
function id(n){return document.getElementById(n);}
var clone = (function(){ 
  return function (obj) { Clone.prototype=obj; return new Clone() };
  function Clone(){}
}());

// this function does not clone the object inside, only the array refs
function cloneArr(arr){
	var cloned = [];
	for(var i = 0; i<arr.length; i++){
		cloned.push(arr[i]);
	}
	return cloned;
}

// a session occupies a fixed time slot. Can be a lab, a tutorial or lecture
function Session()
{
	this['type']="";
	this['group']="";
	this['day']="";
	this['time']="";
	this['venue']="";
	this['remark']="";
	this['iDay']=0;
	this['iTime']=0;
	this['iStart']=0;
	this['iEnd']=0;
}

// a Group is an Index, which contains multiple sessions
function Group()
{
	this['index']=0;
	this['vacancy']=0;
	this['sessions']=[];
	this['codedTime']=[0,0,0,0,0];
	this['course']=null;
}

// a course has multiple indices
function Course()
{
	this['title']="";
	this['groups']=[];
}


function processSession(s,g)
{
	switch (s.day)
	{
		case "MON": s.iDay = 0; break;
		case "TUE": s.iDay = 1; break;
		case "WED": s.iDay = 2; break;
		case "THU": s.iDay = 3; break;
		case "FRI": s.iDay = 4; break;
		default: MessageBox.Show("Error"); break;
	};
	var times = s.time.split('-' );
	var start, end;
	start = parseInt(times[0]);
	end = parseInt(times[1]);
	start = Math.floor(start / 100) - 8;
	end = Math.floor(end / 100)- 8;
	s.iStart = start;
	s.iEnd = end;
	s.iTime = 0;
	var odd = s.remark.indexOf("Wk1,3") == 0;
	var even = s.remark.indexOf("Wk2,4") == 0;
	for (var i = start; i < end; i++)
	{
		if (!odd) // even first at lower position
			s.iTime |= 1 << i * 2;
		if (!even)// odd at higher position
			s.iTime |= 1 << i * 2 + 1;
	}
	g.sessions.push(s);
}

// consolidate a group's session time into a codedTime
// update group's vacancy, and put it into store
function processGroup(g)
{
	for (var i = 0; i < g.sessions.length; i++)
		g.codedTime[g.sessions[i].iDay] |= g.sessions[i].iTime;
	//if(useVacancy && !vacancyStore.TryGetValue(g.index, out g.vacancy))
	//	report+="Error: vacancy information not found for "+g.index.ToString()+System.Environment.NewLine;
	g.vacancy = vacancyStore[g.index];
	groupStore[g.index+""] = g;
}

var courseStore = [];
var groupStore  = [];
var vacancyStore= [];
var buffer = "";
var count = 0;
var chosenCourses = [];
var useVacancy = false;

// schedules is an array of clash-free timetables found through Descend
// each timetable is an array like this:
//   [score, codedTime, chosenGroups]
var schedules = [];


// Initialize penalties for score computation
function InitV0V3(){
	p0 = Math.floor(id("v0").value);
	p1 = Math.floor(id("v1").value);
	p2 = Math.floor(id("v2").value);
	p3 = Math.floor(id("v3").value);
}
// this is the function we use to score a clash-free timetable
// - penalize early morning sessions
function Score(codedTime) {
	// iStart: 0 for 830, 1 for 930
	// we start at 0. If something bad is found, we reduce the score 
	var score = 0; 
	// go through each day, look for things to penalize
	// we look at bit 0, 1, 2 and 3
	// 0 and 1 = 830-930, even and odd week. 
	// 2 and 3 = 930-1030, even and odd week
	var v0 = 1<<0,
		v1 = 1<<1,
		v2 = 1<<2,
		v3 = 1<<3;
	for(var i = 0; i<5; i++){
		if((v0 & codedTime[i])!=0)
			score += p0;
		if((v1 & codedTime[i])!=0)
			score += p1;
		if((v2 & codedTime[i])!=0)
			score += p2;
		if((v3 & codedTime[i])!=0)
			score += p3;
	}
	return score;
}

function AddToSchedules(codedTime, chosenGroups){
	schedules.push([
			Score(codedTime), 
			cloneArr(codedTime), 
			cloneArr(chosenGroups)
	]);
}

// we use score==1 to represent not using score
function AddToBuffer(chosenGroups, score){
	for (var i = 0; i < chosenGroups.length; i++)
		buffer += (chosenGroups[i].index + " ");
	if(useVacancy)
	{
		buffer += (" (");
		for (var i = 0; i < chosenGroups.length; i++)
			buffer += (chosenGroups[i].vacancy + ",");
		buffer += (")");
	}
	if(score!=1)
		buffer += " ("+score+")\t";
	buffer+="\n";
}

// descend the search tree, and put conflict-free arrangements into buffer
// also copy the information to 
function Descend(codedTime, chosenGroups, level)
{
	if (level == chosenCourses.length)
	{
		// add it to schedules
		AddToSchedules(codedTime, chosenGroups);
		// add info to buffer
		AddToBuffer(chosenGroups, 1);
		count++;
		return;
	}
	var course = chosenCourses[level];
	// go through all groups in the course
	for (var i = 0; i < course.groups.length; i++)
	{
		var g = course.groups[i];
		if( !g.enabled) continue;
		if (useVacancy && g.vacancy == 0) continue;
		var templateTime = clone(codedTime);
		var conflict = false;
		for (var j = 0; j < 5; j++)
		{
			if ((templateTime[j] & g.codedTime[j]) != 0)
			{
				conflict = true;
				break;
			}
			else
				templateTime[j] |= g.codedTime[j];
		}
		if (!conflict)
		{
			chosenGroups.push(g);
			Descend(templateTime, chosenGroups, level+1);
			chosenGroups.pop();
		}
	}
}

function SetVacancy()
{
	useVacancy = id("src_vacancy").value != "";
	if(!useVacancy) return;
	var lines = id("src_vacancy").value.split('\n');
	for(var i = 0; i<lines.length; i++)
	{
		var line = lines[i];
		if (line.indexOf("<OPTION") < 0 || line.indexOf("value=") < 0 || line.indexOf("value=>") >= 0)
			continue;
		var parts = line.split(/[=>/]/);
		if (parts.length != 5) continue;
		var index = parseInt(parts[1]);
		var vacancy = parseInt(parts[3]);
		if(groupStore[index])
			groupStore[index].vacancy=vacancy;
		//vacancyStore[index] = vacancy;
	}
}

function Analyze()
{
	// begin initialization
	SetVacancy();
	var chosenGroups = [];
	var codedTime = [0,0,0,0,0];
	buffer="";
	nxt=0;
	count=0;
	chosenCourses = [];
	schedules = [];
	InitV0V3();
	// end initialization
	//
	// find the courses/groups that are chosen
	var sel = id("courseSelect").getElementsByClassName("coursediv");
	for(var i = 0; i<sel.length; i++) {
		var checkbs = sel[i].getElementsByClassName("coursecheck");
		if(checkbs[0].checked)
			chosenCourses.push(courseStore[sel[i].getAttribute('coursename')]);
		checkbs = sel[i].getElementsByClassName("indexcheck");
		for(var j = 0; j<checkbs.length; j++) {
			groupStore[checkbs[j].id].enabled = checkbs[j].checked;
		}
	}
	Descend(codedTime, chosenGroups, 0);
	if(count==0)
		alert("There is no way your selected courses can be scheduled together. Try disabling some courses.");
	else{
		alert(count+" results found");
		// we ignore previous buffer build up during Descend
		// and create a new buffer according to scores
		buffer = "";
		schedules.sort(function(a,b){return b[0]-a[0];});
		for(var i = 0; i<schedules.length; i++)
			AddToBuffer(schedules[i][2], schedules[i][0]);
		id("txt_result").value = buffer;
	}
}
function Draw()
{
	var res = id("txt_result");
	var ss = res.selectionStart;
	var lines = res.value.split("\n");
	var c=0;
	var i;
	// find the selected line
	for(i = 0; i<lines.length; i++)
	{
		c+=lines[i].length+1;
		if(c>ss)break;
	}
	var line = lines[i].split("(")[0];
	line = line.split(" ");
	// coloring
	for(var i = 0; i<5; i++)
		for(var j = 0; j<12; j++)
			id("bbbox_"+i+"_"+j).style.backgroundColor="white";
	for(var i = 0; i<line.length; i++)
	{
		if(line[i]=="")continue;
		var group = groupStore[line[i]];
		var sessions = group.sessions;
		for(var j = 0; j<sessions.length; j++){
			for(var k = sessions[j].iStart; k<sessions[j].iEnd; k++){
				var box = id("bbbox_"+sessions[j].iDay+"_"+k);
				box.style.backgroundColor="#F90";
				var name = group.course.name;
				name = name.split(" ")[0];
				var dispStr = name + "\n" + sessions[j].type;
				box.innerHTML = dispStr ;
				box.innerText = dispStr;
			}
		}
	}
}
// create the timetable boxes
function Init()
{
	if(!document.getElementsByClassName)
		alert("You're running on an old, unsupported browser. Get a new browser!");
	var tb = id("timetable");
	for(var j = 0; j<12; j++)
	{
		for(var i=0; i<5; i++)
		{
			var box = document.createElement("div");
			box.className = "bbbox";
			box.id="bbbox_"+i+"_"+j;
			tb.appendChild(box);
			//boxex[i].push(box);
		}
		tb.innerHTML+="<br style='clear:both'/>";
	}
}


function XML()
{
	var req = new XMLHttpRequest();
	var url = "https://wish.wis.ntu.edu.sg/webexe/owa/AUS_SCHEDULE.main_display1?staff_access=false&acadsem=2014;1&r_subj_code="+
		id("coursecode").value+"&boption=Search&r_search_type=F";
	var query="select * from html where url='"+url+"'";
	var requrl = "http://query.yahooapis.com/v1/public/yql?q="+encodeURIComponent(query);
	req.open("GET", requrl, true);
	req.send();
	req.onreadystatechange=function()
	{
		if(req.readyState==4)
		{
			var xml = (new DOMParser()).parseFromString(req.responseText, "text/xml");
			var center = xml.firstChild.firstChild.firstChild.childNodes[1];
			var tables = center.getElementsByTagName("table");
			//get course name
			var courseRow = tables[0].getElementsByTagName("tr")[0].getElementsByTagName("font");
			var courseName= courseRow[0].textContent+" "+courseRow[1].textContent;
			if(courseStore[courseName]){
				alert("The course "+courseName+" already exists");
				return;
			}
			//get sessions and groups
			var session;
			var group=0;
			var course=new Course();
			course.name = courseName;
			courseRow = tables[1].getElementsByTagName("tr");
			for(var i = 1; i<courseRow.length; i++){
				var columns = courseRow[i].getElementsByTagName("strong");
				var index = columns[0].textContent;
				var m = 0;
				// open new group
				if(!isNaN(index)){
					if(group!=0)course.groups.push(group);
					group = new Group();
					group.course = course;
					group.index = parseInt(index);
					m=1;
				}
				session = new Session();
				session.type  = columns[0+m].textContent;
				session.group = columns[1+m].textContent;
				session.day   = columns[2+m].textContent;
				session.time  = columns[3+m].textContent;
				session.venue = columns[4+m].textContent;
				if(columns.length>5+m)
					session.remark= columns[5+m].textContent;
				processSession(session, group);
			}
			if(group.index!=0)
				course.groups.push(group);
			for(var i = 0; i<course.groups.length; i++)
				processGroup(course.groups[i]);
			courseStore.push(course);
			courseStore[course.name] = course;
			var newCourseCheck = 
				"<div class='coursediv' coursename='"+courseName+"'>"+
				"<input class='coursecheck' type=checkbox checked=true><a target=_blank href='"+
				url+"'>"+courseName+"</a></input>"+
				"<span class='button' onclick='CheckIndices(this, false)'>Disable all</span>"+
				"<span class='button' onclick='CheckIndices(this, true)'>Enable all</span>"+
				"<span class='button' onclick='RemoveCourse(this)'>Remove</span>"+
				"<div class='groupdiv'>";
			for(var i = 0; i<course.groups.length; i++){
				newCourseCheck += 
				"<input type=checkbox class='indexcheck' checked=true id='"+
				course.groups[i].index+"'>"+
				course.groups[i].index+"</input>";
			}
			newCourseCheck += "</div></div>";
			id("courseSelect").innerHTML += newCourseCheck;
		}
	}
}

function CheckIndices(button, enable)
{
	var checkbs = button.parentNode.getElementsByTagName("div")[0].getElementsByTagName("input");
	for(var i = 0; i<checkbs.length; i++)
		checkbs[i].checked = enable;
}
function RemoveCourse(button)
{
	var name = button.parentNode.getAttribute("coursename");
	var course = courseStore[name];
	for(var i = 0; i<course.groups.length; i++)
		delete groupStore[course.groups[i].index];
	delete courseStore[name];
	button.parentNode.parentNode.removeChild(button.parentNode);
}
function ShowHelp()
{
	var helps = document.getElementsByClassName("help_hide");
	if(helps.length==0){
		helps = document.getElementsByClassName("help_show");
		for(var i = helps.length-1; i>=0; i--)
			helps[i].className = "help_hide";
		return;
	}
	for(var i = helps.length-1; i>=0; i--)
		helps[i].className = "help_show";
}
