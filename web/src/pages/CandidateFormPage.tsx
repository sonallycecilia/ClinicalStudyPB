import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { CandidateForm } from '../candidates/CandidateForm';
import { useRecruitmentStudies } from '../candidates/useRecruitmentStudies';
import { useAuth } from '../auth/AuthContext';
import { candidatesApi } from '../candidates/candidatesApi';

export function CandidateFormPage() {
  const navigate = useNavigate();
  const studies = useRecruitmentStudies();
  const { request } = useAuth();
  const [savedStudyId, setSavedStudyId] = useState('');
  const listState = { candidateStudyId: savedStudyId };

  return <div className="coord-page candidate-form-page">
    <header className="coord-page-heading">
      <h1><Link to="/coordenador/candidatos" state={listState}>Candidatos e participantes</Link> <span aria-hidden="true">&gt;</span> Cadastrar candidato</h1>
    </header>
    <section className="study-form-panel candidate-form-panel" aria-labelledby="candidate-form-title">
      <div className="study-form-heading"><h2 id="candidate-form-title">Informações do candidato</h2></div>
      <CandidateForm studies={studies} onSubmit={async (input) => {
        await candidatesApi.create(request, input);
        setSavedStudyId(input.id_estudo);
      }} onCancel={() => navigate('/coordenador/candidatos', { state: listState })} />
    </section>
  </div>;
}
