import pg from "pg";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// Add display_label column if it doesn't exist
await db.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS display_label text`);
console.log("Column ready.");

// Authoritative date/label mapping from user-provided list
const MONTH_MAP = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

const raw = `Sep 2004	1
Oct 2004	2
Nov 2004	3
Dec 2004	4
Feb 2005	5
Mar 2005	6
Apr 2005	7
May 2005	8
Jun 2005	9
Jul 2005	10
Aug 2005	11
Sep 2005	12
Oct 2005	13
Nov 2005	14
Dec 2005	15
Feb 2006	16
Mar 2006	17
Apr 2006	18
May 2006	19
Jun 2006	20
Jul 2006	21
Aug 2006	22
Sep 2006	23
Oct 2006	24
Nov 2006	25
Dec 2006	26
Feb 2007	27
Mar 2007	28
Apr 2007	29
May 2007	30
Jun 2007	31
Jul 2007	32
Aug 2007	33
Sep 2007	34
Oct 2007	35
Nov 2007	36
Dec 2007	37
Feb 2008	38
Mar 2008	39
Apr 2008	40
May 2008	41
Jun 2008	42
Jul 2008	43
Aug 2008	44
Sep 2008	45
Oct 2008	46
Nov 2008	47
Dec 2008	48
Feb 2009	49
Mar 2009	50
Apr 2009	51
May 2009	52
Jun 2009	53
Jul 2009	54
Aug 2009	55
Sep 2009	56
Oct 2009	57
Nov 2009	58
Dec 2009	59
Feb 2010	60
Mar 2010	61
Apr 2010	62
May 2010	63
Jun 2010	64
Jul 2010	65
Aug 2010	66
Sep 2010	67
Oct 2010	68
Nov 2010	69
Dec 2010	70
Feb 2011	71
Mar 2011	72
Apr 2011	73
May 2011	74
Jun 2011	75
Jul 2011	76
Aug 2011	77
Sep 2011	78
Oct 2011	79
Nov 2011	80
Dec 2011	81
Feb 2012	82
Mar 2012	83
Apr 2012	84
May 2012	85
Jun 2012	86
Jul 2012	87
Aug 2012	88
Sep 2012	89
Oct 2012	90
Nov 2012	91
Dec 2012	92
Feb 2013	93
Mar 2013	94
Apr 2013	95
May 2013	96
Jun 2013	97
Jul 2013	98
Aug 2013	99
Sep 2013	100
Oct 2013	101
Nov 2013	102
Dec 2013	103
Feb 2014	104
Mar 2014	105
Apr 2014	106
May 2014	107
Jun 2014	108
Jul 2014	109
Aug 2014	110
Sep 2014	111
Oct 2014	112
Nov 2014	113
Dec 2014	114
Feb 2015	115
Mar 2015	116
Apr 2015	117
May 2015	118
Jun 2015	119
Jul 2015	120
Aug 2015	121
Sep 2015	122
Oct 2015	123
Nov 2015	124
Dec 2015	125
Feb 2016	126
Mar 2016	127
Apr 2016	128
May 2016	129
Jun 2016	130
Jul 2016	131
Aug 2016	132
Sep 2016	133
Oct 2016	134
Nov 2016	135
Dec 2016	136
Feb 2017	137
Mar 2017	138
Apr 2017	139
May 2017	140
Jun 2017	141
Jul 2017	142
Aug 2017	143
Sep 2017	144
Oct 2017	145
Nov 2017	146
Dec 2017	147
Feb 2018	148
Mar 2018	149
Apr 2018	150
May 2018	151
Jun 2018	152
Jul 2018	153
Aug 2018	154
Sep 2018	155
Oct 2018	156
Nov 2018	157
Dec 2018	158
Feb 2019	159
Mar 2019	160
Apr 2019	161
May 2019	162
Jun 2019	163
Jul 2019	164
Aug 2019	165
Sep 2019	166
Oct 2019	167
Nov 2019	168
Dec 2019	169
Feb 2020	170
Mar 2020	171
Apr 2020	172
Covid 2020	173
Autumn 2020	174
Winter 2020	175
Feb/Mar 2021	176
Apr/May 2021	177
Jun/Jul 2021	178
Aug/Sep 2021	179
Oct/Nov 2021	180
Dec/Jan 2021	181
Feb/Mar 2022	182
Apr/May 2022	183
Jun/Jul 2022	184
Aug/Sep 2022	185
Oct/Nov 2022	186
Dec/Jan 2022	187
Feb/Mar 2023	188
Apr/May 2023	189
Jun/Jul 2023	190
Aug/Sep 2023	191
Oct/Nov 2023	192
Dec/Jan 2023	193
Feb/Mar 2024	194
Apr/May 2024	195
Jun/Jul 2024	196
Aug/Sep 2024	197
Oct/Nov 2024	198
Dec/Jan 2024	199
Feb/Mar 2025	200
Apr/May 2025	201
Jun/Jul 2025	202
Aug/Sep 2025	203
Oct/Nov 2025	204
Dec/Jan 2025	205
Feb/Mar 2026	206
Apr/May 2026	207
Jun/Jul 2026	208
Aug/Sep 2026	209
Oct/Nov 2026	210
Dec/Jan 2026	211
Feb/Mar 2027	212
Apr/May 2027	213
Jun/Jul 2027	214
Aug/Sep 2027	215
Oct/Nov 2027	216
Dec/Jan 2027	217`;

function parseEntry(label, num) {
  // Standard: "Sep 2004", "Feb 2020"
  const simple = label.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (simple) {
    const m = MONTH_MAP[simple[1]];
    const y = parseInt(simple[2]);
    if (m && y) return { date: new Date(Date.UTC(y, m - 1, 1)), label: null };
  }

  // Bi-monthly: "Feb/Mar 2026", "Aug/Sep 2021", "Dec/Jan 2021"
  const biMonth = label.match(/^([A-Za-z]+)\/([A-Za-z]+)\s+(\d{4})$/);
  if (biMonth) {
    const m1 = MONTH_MAP[biMonth[1]];
    const y = parseInt(biMonth[3]);
    // Dec/Jan means Dec of year Y (the first month)
    if (m1 && y) return { date: new Date(Date.UTC(y, m1 - 1, 1)), label };
  }

  // Special: "Covid 2020" → May 2020 (issue 173)
  if (label === "Covid 2020") return { date: new Date(Date.UTC(2020, 4, 1)), label };
  // "Autumn 2020" → Sep 2020
  if (label === "Autumn 2020") return { date: new Date(Date.UTC(2020, 8, 1)), label };
  // "Winter 2020" → Dec 2020
  if (label === "Winter 2020") return { date: new Date(Date.UTC(2020, 11, 1)), label };

  console.warn(`Could not parse label: "${label}" for issue ${num}`);
  return { date: null, label };
}

const lines = raw.trim().split("\n");
let updated = 0, inserted = 0, skipped = 0;

for (const line of lines) {
  const parts = line.split("\t");
  if (parts.length < 2) continue;
  const labelStr = parts[0].trim();
  const num = parseInt(parts[1].trim());
  if (!num || isNaN(num)) continue;

  const { date, label } = parseEntry(labelStr, num);

  const result = await db.query(`
    INSERT INTO issues (number, title, published_at, display_label)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (number) DO UPDATE SET
      published_at = $3,
      display_label = $4
    RETURNING (xmax = 0) as inserted
  `, [num, `Gallery #${num}`, date ? date.toISOString() : null, label]);

  if (result.rows[0]?.inserted) inserted++;
  else updated++;
}

await db.end();
console.log(`Done: ${updated} updated, ${inserted} newly inserted, ${skipped} skipped`);
