fetch('https://orbinuity.nl/nogo/projects.json')
    .then(res => res.json())
    .then(projects => {
        const dropdown = document.getElementById('dropdown-content');
        Object.keys(projects).forEach(project => {
            const a = document.createElement('a');
            a.href = `/doc?project=${project}`
            a.textContent = projects[project][0];

            dropdown.appendChild(a);
        });
    });