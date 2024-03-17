{
	"translatorID": "56f6d95e-275d-4aa3-b239-637ae2bbd568",
	"label": "beck-online-jku",
	"creator": "Daniel Eder",
	"target": "^https?:\\/\\/beck[-.].*?online.*?\\.han\\.ubl\\.jku\\.at\\/",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2024-03-17 09:52:21"
}

/*
	***** BEGIN LICENSE BLOCK *****

	beck-online Translator, Copyright © 2014 Philipp Zumstein
	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero. If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/


var mappingClassNameToItemType = {
	ZAUFSATZ: 'journalArticle',
	ZRSPR: 'case', // Rechtssprechung
	ZRSPRAKT: 'case',
	BECKRS: 'case',
	ZENTB: 'journalArticle', // Entscheidungsbesprechung
	ZBUCHB: 'journalArticle', // Buchbesprechung
	ZSONST: 'journalArticle', // Sonstiges, z.B. Vorwort,
	LSK: 'journalArticle', // Artikel in Leitsatzkartei
	ZINHALTVERZ: 'multiple', // Inhaltsverzeichnis
	KOMMENTAR: 'encyclopediaArticle',
	ALTEVERSION: 'encyclopediaArticle',
	'ALTEVERSION KOMMENTAR': 'encyclopediaArticle',
	HANDBUCH: 'encyclopediaArticle',
	BUCH: 'book',
	// ? 'FESTSCHRIFT' : 'bookSection'
};

// build a regular expression for author cleanup in authorRemoveTitlesEtc()
var authorTitlesEtc = ['\\/',
	'Dr\\.',
	'\\b[ji]ur\\.',
	'\\bh\\. c\\.',
	'Prof\\.',
	'Professor(?:in)?',
	'\\bwiss\\.',
	'Mitarbeiter(?:in)?',
	'RA(?:in)?,?', 
	'RA(?:in)?',
	'PD',
	'FAArbR',
	'Fachanwalt für Insolvenzrecht',
	'Rechtsanw[aä]lt(?:e|in)?',
	'Richter am (?:AG|LG|OLG|BGH)',
	'\\bzur Fussnote',
	'LL\\.\\s?M\\.(?: \\(UCLA\\))?',
	'^Von',
	"\\*"];
var authorRegEx = new RegExp(authorTitlesEtc.join('|'), 'g');


function detectWeb(doc, _url) {
	var dokument = doc.getElementById("dokument");
	if (!dokument) {
		return getSearchResults(doc, true) ? "multiple" : false;
	}
	
	var type = mappingClassNameToItemType[dokument.className.toUpperCase()];
	// Z.debug(dokument.className.toUpperCase());
	if (type == 'multiple') {
		return getSearchResults(doc, true) ? "multiple" : false;
	}
	
	return type;
}

function getSearchResults(doc, checkOnly) {
	var items = {}, found = false,
		rows = ZU.xpath(doc, '//div[@class="inh"]//span[@class="inhdok"]//a | //div[@class="autotoc"]//a | //div[@id="trefferliste"]//a[@class="sndline"]');

	for (var i = 0; i < rows.length; i++) {
		// rows[i] contains an invisible span with some text, which we have to exclude, e.g.
		//   <span class="unsichtbar">BKR Jahr 2014 Seite </span>
		//   Dr. iur. habil. Christian Hofmann: Haftung im Zahlungsverkehr
		var title = ZU.trimInternal(ZU.xpathText(rows[i], './text()[1]'));
		var link = rows[i].href;
		if (!link || !title) continue;
		
		if (checkOnly) return true;
		found = true;
		
		items[link] = title;
	}
	
	return found ? items : false;
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		Zotero.selectItems(getSearchResults(doc), function (items) {
			if (!items) {
				return;
			}
			var articles = [];
			for (var i in items) {
				articles.push(i);
			}
			ZU.processDocuments(articles, scrape);
		});
	}
	else {
		scrape(doc, url);
	}
}

function authorRemoveTitlesEtc(authorStr) {
	// example 1: Dr. iur. Carsten Peter
	// example 2: Rechtsanwälte Christoph Abbott
	// example 3: Professor Dr. Klaus Messer
	return ZU.trimInternal(ZU.trimInternal(authorStr).replace(authorRegEx, ""));
}

function scrapeKommentar(doc, url) {
	var item = new Zotero.Item("encyclopediaArticle");
	
	item.title = ZU.xpathText(doc, '//div[@class="dk2"]//span[@class="ueber"]');
	
	var authorText = ZU.xpathText(doc, '//div[@class="dk2"]//span[@class="autor"]');
	if (authorText) {
		var authors = authorText.split("/");
		for (let i = 0; i < authors.length; i++) {
			item.creators.push(ZU.cleanAuthor(authors[i], 'author', false));
		}
	}
	
	// e.g. a) Beck'scher Online-Kommentar BGB, Bamberger/Roth
	// e.g. b) Langenbucher/Bliesener/Spindler, Bankrechts-Kommentar
	// e.g. c) Scherer, Münchener Anwaltshandbuch Erbrecht
	var citationFirst = ZU.xpathText(doc, '//div[@class="dk2"]//span[@class="citation"]/text()[following-sibling::br and not(preceding-sibling::br)]', null, ' ');// e.g. Beck'scher Online-Kommentar BGB, Bamberger/Roth
	var pos = citationFirst.lastIndexOf(",");
	if (pos > 0) {
		item.publicationTitle = ZU.trimInternal(citationFirst.substr(0, pos));
		var editorString = citationFirst.substr(pos + 1);
		
		if ((!editorString.includes("/") && item.publicationTitle.includes("/"))
			|| editorString.toLowerCase().includes("handbuch")
			|| editorString.toLowerCase().includes("kommentar")
		) {
			var temp = item.publicationTitle;
			item.publicationTitle = editorString;
			editorString = temp;
		}
		editorString = editorString.replace(/, /g, '');
		
		var editors = editorString.trim().split("/");
		for (let i = 0; i < editors.length; i++) {
			item.creators.push(ZU.cleanAuthor(editors[i], 'editor', false));
		}
	}
	else {
		// e.g. Münchener Kommentar zum BGB
		// from https://beck-online.beck.de/?vpath=bibdata%2fkomm%2fmuekobgb_7_band2%2fbgb%2fcont%2fmuekobgb.bgb.p305.htm
		item.publicationTitle = ZU.trimInternal(citationFirst);
	}
	
	var editionText = ZU.xpathText(doc, '//div[@class="dk2"]//span[@class="citation"]/text()[preceding-sibling::br]');
	if (editionText) {
		if (editionText.search(/\d+/) > -1) {
			item.edition = editionText.match(/\d+/)[0];
		}
		else {
			item.edition = editionText;
		}
	}
	item.date = ZU.xpathText(doc, '//div[@class="dk2"]//span[@class="stand"]');
	if (!item.date && editionText.match(/\d{4}$/)) {
		item.date = editionText.match(/\d{4}$/)[0];
	}

	finalize(doc, url, item);
}


// scrape documents that are only in the beck-online "Leitsatz-Kartei", i.e.
// where only information about the article, not the article itself is in beck-online
function scrapeLSK(doc, url) {
	var item = new Zotero.Item(mappingClassNameToItemType.LSK);
	
	// description example 1: "Marco Ganzhorn: Ist ein E-Book ein Buch?"
	// description example 2: "Michael Fricke/Dr. Martin Gerecke: Informantenschutz und Informantenhaftung"
	// description example 3: "Sara Sun Beale: Die Entwicklung des US-amerikanischen Rechts der strafrechtlichen Verantwortlichkeit von Unternehmen"
	var description = ZU.xpathText(doc, "//*[@id='dokcontent']/h1");
	var descriptionItems = description.split(':');

	// authors
	var authorsString = descriptionItems[0];
	
	var authors = authorsString.split("/");

	for (var index = 0; index < authors.length; ++index) {
		var author = authorRemoveTitlesEtc(ZU.trimInternal(authors[index]));
		item.creators.push(ZU.cleanAuthor(author, 'author', false));
	}
	
	// title
	item.title = ZU.trimInternal(descriptionItems[1]);
	
	// src => journalTitle, date and pages
	// example 1: "Ganzhorn, CR 2014, 492"
	// example 2: "Fricke, Gerecke, AfP 2014, 293"
	// example 3 (no date provided): "Beale, ZStrW Bd. 126, 27"
	var src = ZU.xpathText(doc, "//div[@class='lsk-fundst']/ul/li");
	var m = src.trim().match(/([^,]+?)(\b\d{4})?,\s*(\d+)$/);
	if (m) {
		item.pages = m[3];
		if (m[2]) item.date = m[2];
		item.publicationTitle = ZU.trimInternal(m[1]);
		item.journalAbbreviation = item.publicationTitle;
		
		// if src is like example 3, then extract the volume
		var tmp = item.publicationTitle.match(/(^[A-Za-z]+) Bd\. (\d+)/);
		if (tmp) {
			item.publicationTitle = tmp[1];
			item.journalAbbreviation = item.publicationTitle;
			item.volume = tmp[2];
		}
	}

	finalize(doc, url, item);
}


function scrapeBook(doc, _url) {
	var item = new Zotero.Item("book");
	item.title = text(doc, '#titelseitetext .tptitle');
	item.shortTitle = attr(doc, '.bf_selected span[title]', 'title');
	var creatorType = "author";
	var contributorsAreNext = false;
	var contributors;
	var spaces = doc.querySelectorAll('#titelseitetext .tpspace');
	for (let space of spaces) {
		if (space.textContent.includes("Kommentar")) {
			item.title += ": Kommentar";
		}
		if (space.textContent.includes("Herausgegeben")) {
			creatorType = "editor";
		}
		// e.g. "2. Auflage 2018"
		if (space.textContent.includes("Auflage")) {
			let parts = space.textContent.split("Auflage");
			item.edition = parts[0].replace('.', '');
			item.date = parts[1];
		}
		
		if (contributorsAreNext) {
			contributors = space.textContent.split("; ");
			contributorsAreNext = false;
		}
		if (space.textContent.includes("Bearbeitet")) {
			contributorsAreNext = true;
		}
	}
	var creators = doc.querySelectorAll('#titelseitetext .tpauthor');
	for (let creator of creators) {
		creator = authorRemoveTitlesEtc(creator.textContent);
		item.creators.push(ZU.cleanAuthor(creator, creatorType));
	}
	if (contributors) {
		for (let contributor of contributors) {
			contributor = authorRemoveTitlesEtc(contributor);
			item.creators.push(ZU.cleanAuthor(contributor, "contributor"));
		}
	}
	item.ISBN = text(doc, '#titelseitetext .__beck_titelei_impressum_isbn');
	item.rights = text(doc, '#titelseitetext .__beck_titelei_impressum_p');
	if (item.rights && item.rights.includes("Beck")) {
		item.publisher = "Verlag C. H. Beck";
		item.place = "München";
	}
	item.complete();
}

function addNote(originalNote, newNote) {
	if (originalNote.length == 0) {
		originalNote = "<h2>Additional Metadata</h2>" + newNote;
	}
	else {
		originalNote += newNote;
	}
	return originalNote;
}

function scrapeCase(doc, url) {
	var documentClassName = doc.getElementById("dokument").className.toUpperCase();
	
	var item = new Zotero.Item('case');
	var note = "";
		
	// case name
	// in some cases, the caseName is in a separate <span>
	var caseName = ZU.xpathText(doc, '//div[@class="titel sbin4"]/h1/span');
	// if not, we have to extract it from the title
	if (!caseName) {
		var caseDescription = ZU.xpathText(doc, '//div[contains(@class, "titel")]/h1');
		if (caseDescription) {
			// take everything after the last slash
			var tmp = caseDescription.split(/\s[-–]\s/);
			caseName = tmp[tmp.length - 1];
			// sometimes the caseName is enclosed in („”)
			tmp = caseDescription.match(/\(„([^”)]+)”\)/);
			if (tmp) {
				caseName = ZU.trimInternal(tmp[1]);
			}
			if (caseDescription != caseName) {
				// save the former title (which is mostly a description of the case by the journal it is published in) in the notes
				note = addNote(note, "<h3>Beschreibung</h3><p>" + ZU.trimInternal(caseDescription) + "</p>");
			}
		}
		if (caseName) {
			item.shortTitle = caseName.trim().replace(/^\*|\*$/, '').trim();
		}
	}
	
	var courtLine = ZU.xpath(doc, '//div[contains(@class, "gerzeile")]/p')[0];
	var alternativeLine = "";
	var alternativeData = [];
	if (courtLine) {
		item.court = ZU.xpathText(courtLine, './span[@class="gericht"] | ./span[@class="GERICHT"]');
	}
	else {
		alternativeLine = ZU.xpathText(doc, '//span[@class="entscheidung"]');
		// example: OLG Köln: Beschluss vom 23.03.2012 - 6 U 67/11
		alternativeData = alternativeLine.match(/^([A-Za-zÖöÄäÜüß ]+): \b(.*?Urteil|.*?Urt\.|.*?Beschluss|.*?Beschl\.) vom (\d\d?\.\s*\d\d?\.\s*\d\d\d\d) - ([\w\s/]*)/i);
		item.court = ZU.trimInternal(alternativeData[1]);
	}
	
	// add jurisdiction to item.extra - in accordance with citeproc-js - for compatability with Zotero-MLZ
	item.extra = "";
	if (item.court.indexOf('EuG') == 0) {
		item.extra += "Jurisdiction: europa.eu";
	}
	else {
		item.extra += "Jurisdiction: de";
	}
	
	var decisionDateStr = ZU.xpathText(doc, '(//span[@class="edat"] | //span[@class="EDAT"] | //span[@class="datum"])[1]');
	if (decisionDateStr === null) {
		decisionDateStr = alternativeData[3];
	}
	// e.g. 24. 9. 2001 or 24-9-1990
	item.dateDecided = decisionDateStr.replace(/(\d\d?)[.-]\s*(\d\d?)[.-]\s*(\d\d\d\d)/, "$3-$2-$1");
	
	item.docketNumber = ZU.xpathText(doc, '(//span[@class="az"])[1]');
	if (item.docketNumber === null) {
		item.docketNumber = alternativeData[4];
	}
	
	item.title = item.court + ", " + decisionDateStr + " - " + item.docketNumber;
	if (item.shortTitle) {
		item.title += " - " + item.shortTitle;
	}
	
	var decisionType;
	if (courtLine) {
		item.history = ZU.xpathText(courtLine, './span[@class="vorinst"]');
	
		// type of decision. Save this in item.extra according to citeproc-js
		decisionType = ZU.xpathText(courtLine, './span[@class="etyp"]');
	}
	
	if (!decisionType) {
		decisionType = alternativeData[2];
	}
	
	if (decisionType) {
		if (/Beschluss|Beschl\./i.test(decisionType)) {
			item.extra += "\nGenre: Beschl.";
		}
		else if (/Urteil|(Urt\.)/i.test(decisionType)) {
			item.extra += "\nGenre: Urt.";
		}
	}
	
	// code to scrape the BeckRS source, if available
	// example: BeckRS 2013, 06445
	// Since BeckRS is not suitable for citing, let's push it into the notes instead
	var beckRSline = ZU.xpathText(doc, '//span[@class="fundstelle"]');
	if (beckRSline) {
		note = addNote(note, "<h3>Fundstelle</h3><p>" + ZU.trimInternal(beckRSline) + "</p>");
		
		/* commented out, because we cannot use it for the CSL-stylesheet at the moment.
		 * If we find a better solution later, we can reactivate this code and save the
		 * information properly
		 *
		var beckRSsrc = beckRSline.match(/^([^,]+)\s(\d{4})\s*,\s*(\d+)/);
		item.reporter = beckRSsrc[1];
		item.date = beckRSsrc[2];
		item.pages = beckRSsrc[3];*/
	}

	var otherCitationsText = ZU.xpathText(doc, '//div[@id="parallelfundstellenNachDokument"]');
	if (otherCitationsText) {
		note = addNote(note, "<h3>Parallelfundstellen</h3><p>" + otherCitationsText.replace(/\n/g, "").replace(/\s+/g, ' ').trim() + "</p>");
	}
	var basedOnRegulations = ZU.xpathText(doc, '//div[contains(@class,"normenk")]');
	if (basedOnRegulations) {
		note = addNote(note, "<h3>Normen</h3><p>" + ZU.trimInternal(basedOnRegulations) + "</p>");
	}
	
	item.abstractNote = ZU.xpathText(doc, '//div[@class="abstract" or @class="leitsatz"]');
	if (item.abstractNote) {
		item.abstractNote = item.abstractNote.replace(/\n\s*\n/g, "\n");
	}

	// there is additional information if the case is published in a journal
	if (documentClassName == 'ZRSPR') {
		// short title of publication, publication year
		item.reporter = ZU.xpathText(doc, '//div[@id="toccontent"]/ul/li/a[2]');
		item.reporterVolume = ZU.xpathText(doc, '//div[@id="toccontent"]/ul/li/ul/li/a[2]');
		// long title of publication
		var publicationTitle = ZU.xpathText(doc, '//li[@class="breadcurmbelemenfirst"]');
		if (publicationTitle) {
			note = addNote(note, "<h3>Zeitschrift Titel</h3><p>" + ZU.trimInternal(publicationTitle) + "</p>");
		}
		
		// e.g. ArbrAktuell 2014, 150
		var shortCitation = ZU.xpathText(doc, '//div[@class="dk2"]//span[@class="citation"]');
		var pagesStart = ZU.trimInternal(shortCitation.substr(shortCitation.lastIndexOf(",") + 1));
		var pagesEnd = ZU.xpathText(doc, '(//span[@class="pg"])[last()]');
		if (pagesEnd) {
			item.pages = pagesStart + "-" + pagesEnd;
		}
		else {
			item.pages = pagesStart;
		}
	}
	
	if (note.length != 0) {
		item.notes.push({ note: note });
	}
	
	finalize(doc, url, item);
}


function scrape(doc, url) {
	var dokument = doc.getElementById("dokument");
	if (!dokument) {
		throw new Error("Could not find element with ID 'dokument'. "
		+ "Probably attempting to scrape multiples with no access.");
	}
	var documentClassName = dokument.className.toUpperCase();

	// use different scraping function for documents in LSK
	if (documentClassName == 'LSK') {
		scrapeLSK(doc, url);
		return;
	}
	if (documentClassName == 'BUCH') {
		scrapeBook(doc, url);
		return;
	}
	if (mappingClassNameToItemType[documentClassName] == 'case') {
		scrapeCase(doc, url);
		return;
	}
	if (mappingClassNameToItemType[documentClassName] == 'encyclopediaArticle') {
		scrapeKommentar(doc, url);
		return;
	}

	var item;
	if (mappingClassNameToItemType[documentClassName]) {
		item = new Zotero.Item(mappingClassNameToItemType[documentClassName]);
	}
	
	var titleNode = ZU.xpath(doc, '//div[@class="titel"]')[0]
		|| ZU.xpath(doc, '//div[@class="dk2"]//span[@class="titel"]')[0];
	item.title = ZU.trimInternal(titleNode.textContent);
	
	// in some cases (e.g. NJW 2007, 3313) the title contains an asterisk with a footnote that is imported into the title
	// therefore, this part should be removed from the title
	var indexOfAdditionalText = item.title.indexOf("zur Fussnote");
	if (indexOfAdditionalText != -1) {
		item.title = item.title.substr(0, indexOfAdditionalText);
	}
	
	var authorNode = ZU.xpath(doc, '//div[@class="autor"]');
	for (var i = 0; i < authorNode.length; i++) {
		// normally several authors are under the same authorNode
		// and they occur in pairs with first and last names
		
		var authorFirstNames = ZU.xpath(authorNode[i], './/span[@class="vname"]');
		var authorLastNames = ZU.xpath(authorNode[i], './/span[@class="nname"]');
		for (let j = 0; j < authorFirstNames.length; j++) {
			item.creators.push({
				lastName: authorLastNames[j].textContent,
				firstName: authorFirstNames[j].textContent,
				creatorType: "author"
			});
		}
	}
	
	if (item.creators.length == 0) {
		authorNode = ZU.xpath(doc, '//div[@class="autor"]/p | //p[@class="authorline"]/text() | //div[@class="authorline"]/p/text()');
		for (let j = 0; j < authorNode.length; j++) {
			// first we delete some prefixes
			var authorString = authorRemoveTitlesEtc(authorNode[j].textContent);
			// authors can be seperated by "und" and "," if there are 3 or more authors
			// a comma can also mark the beginning of suffixes, which we want to delete
			// therefore we have to distinguish these two cases in the following
			var posUnd = authorString.indexOf("und");
			var posComma = authorString.indexOf(",");
			if (posUnd > posComma) {
				posComma = authorString.indexOf(",", posUnd);
			}
			if (posComma > 0) {
				authorString = authorString.substr(0, posComma);
			}
			
			var authorArray = authorString.split(/und|,/);
			for (var k = 0; k < authorArray.length; k++) {
				authorString = ZU.trimInternal(authorRemoveTitlesEtc(authorArray[k]));
				item.creators.push(ZU.cleanAuthor(authorString, "author"));
			}
		}
	}
	
	item.publicationTitle = ZU.xpathText(doc, '//li[@class="breadcurmbelemenfirst"]');
	item.journalAbbreviation = ZU.xpathText(doc, '//div[@id="toccontent"]/ul/li/a[2]');
	
	item.date = ZU.xpathText(doc, '//div[@id="toccontent"]/ul/li/ul/li/a[2]');
	
	// e.g. Heft 6 (Seite 141-162)
	var issueText = ZU.xpathText(doc, '//div[@id="toccontent"]/ul/li/ul/li/ul/li/a[2]');

	if (issueText) {
		item.issue = issueText.replace(/\([^)]*\)/, "");
		if (item.issue.search(/\d+/) > -1) {
			item.issue = item.issue.match(/\d+/)[0];
		}
	}
	
	// e.g. ArbrAktuell 2014, 150
	var shortCitation = ZU.xpathText(doc, '//div[@class="dk2"]//span[@class="citation"]');
	if (shortCitation) {
		var pagesStart = ZU.trimInternal(shortCitation.substr(shortCitation.lastIndexOf(",") + 1));
	}
	var pagesEnd = ZU.xpathText(doc, '(//span[@class="pg"])[last()]');
	if (pagesEnd) {
		item.pages = pagesStart + "-" + pagesEnd;
	}
	else {
		item.pages = pagesStart;
	}
	
	item.abstractNote = ZU.xpathText(doc, '//div[@class="abstract"]') || ZU.xpathText(doc, '//div[@class="leitsatz"]');
	if (item.abstractNote) {
		item.abstractNote = item.abstractNote.replace(/\n\s*\n/g, "\n");
	}

	if (documentClassName == "ZBUCHB") {
		item.extra = ZU.xpathText(doc, '//div[@class="biblio"]');
	}
	
	finalize(doc, url, item);
}

function finalize(doc, url, item) {
	item.attachments = [{
		title: "Snapshot",
		document: doc
	}];
	
	// var perma = ZU.xpathText(doc, '//div[@class="doc-link"]/a/@href');
	var perma = ZU.xpathText(doc, '//div[@class="doc-link"]');
	if (perma) {
		// not clear that this case ever comes up - permalinks appear always
		// to be relative now. but just in case it's absolute, we want to strip
		// the domain off and add the known beck-online domain back manually to
		// avoid dot-dash proxy-to-proper confusion
		// (beck-online-beck-de.proxy.university.edu being converted to
		// beck.online.beck.de instead of beck-online.beck.de)
		let pathRe = /^https?:\/\/[^/]+(\/.*)$/;
		if (pathRe.test(perma)) {
			perma = perma.match(pathRe)[1];
		}
		
		if (perma.startsWith('/')) {
			perma = 'https://beck-online.beck.de' + perma;
		}
		
		item.url = perma;
	}
	
	item.complete();
}



/** BEGIN TEST CASES **/
var testCases = [
]
/** END TEST CASES **/
