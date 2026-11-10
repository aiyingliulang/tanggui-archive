(function () {
  'use strict';

  var zhCollator = new Intl.Collator('zh-CN');

  function normalize(value) {
    return String(value == null ? '' : value).normalize('NFKC').toLowerCase();
  }

  function toSavedSet(saved) {
    if (saved instanceof Set) return saved;
    if (Array.isArray(saved)) return new Set(saved);
    return new Set();
  }

  function filterCases(cases, options) {
    var opts = options || {};
    var season = opts.season;
    var savedOnly = !!opts.savedOnly;
    var saved = toSavedSet(opts.saved);
    var terms = normalize(opts.query).split(/\s+/).filter(Boolean);

    return (cases || []).filter(function (c) {
      if (season && season !== 'all' && c.season !== season) return false;
      if (savedOnly && !saved.has(c.id)) return false;
      if (terms.length === 0) return true;

      var haystack = [c.title, c.place, c.hook]
        .concat(c.clues || [])
        .concat(c.people || [])
        .map(normalize)
        .join(' ');

      return terms.every(function (term) {
        return haystack.indexOf(term) !== -1;
      });
    });
  }

  function collectGuests(cases, people) {
    var mains = new Set(
      (people || []).map(function (p) {
        return String(typeof p === 'string' ? p : p.name);
      })
    );
    var byName = new Map();

    (cases || []).forEach(function (c) {
      var seen = new Set();
      (c.people || []).forEach(function (raw) {
        var name = String(raw);
        if (!name || mains.has(name) || seen.has(name)) return;
        seen.add(name);
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push(c.id);
      });
    });

    return Array.from(byName, function (entry) {
      return { name: entry[0], caseIds: entry[1] };
    }).sort(function (a, b) {
      return zhCollator.compare(a.name, b.name);
    });
  }

  function formatEpisodes(episodes) {
    if (!Array.isArray(episodes) || episodes.length === 0) return '分集待核';

    var nums = Array.from(
      new Set(
        episodes
          .map(function (n) { return Number(n); })
          .filter(function (n) { return Number.isFinite(n); })
          .map(function (n) { return Math.trunc(n); })
      )
    ).sort(function (a, b) { return a - b; });

    if (nums.length === 0) return '分集待核';

    var parts = [];
    var start = nums[0];
    var prev = nums[0];

    for (var i = 1; i <= nums.length; i++) {
      var n = nums[i];
      if (n === prev + 1) {
        prev = n;
        continue;
      }
      parts.push(start === prev ? '第 ' + start + ' 集' : '第 ' + start + '–' + prev + ' 集');
      start = prev = n;
    }

    return parts.join('、');
  }

  function groupEpisodes(cases, count) {
    var n = Number(count);
    var total = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    var result = [];

    for (var i = 1; i <= total; i++) {
      result.push({ number: i, caseIds: [] });
    }
    if (total === 0) return result;

    var byNumber = new Map();

    (cases || []).forEach(function (c) {
      var seen = new Set();
      (c.episodes || []).forEach(function (raw) {
        var num = Number(raw);
        if (!Number.isInteger(num) || num < 1 || num > total || seen.has(num)) return;
        seen.add(num);
        if (!byNumber.has(num)) byNumber.set(num, []);
        byNumber.get(num).push(c.id);
      });
    });

    byNumber.forEach(function (caseIds, num) {
      result[num - 1].caseIds = caseIds;
    });

    return result;
  }

  window.ArchiveUtils = {
    filterCases: filterCases,
    collectGuests: collectGuests,
    formatEpisodes: formatEpisodes,
    groupEpisodes: groupEpisodes
  };
})();
